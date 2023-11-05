import { getInput, setOutput } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { diff, detailedDiff } from 'deep-object-diff';

const log = (...args: any[]) => {
  console.log('is-pr-merely-npm-deps-update: ', ...args);
}

const ghToken = process.env.GITHUB_TOKEN;
const depPrefix = getInput("depPrefix");
const depPrefixRegExp = getInput("depPrefixRegExp");
const depPrefixRegExpFlags = getInput("depPrefixRegExpFlags");
const depPrefixRegExpObject = depPrefixRegExp ? new RegExp(depPrefixRegExp, depPrefixRegExpFlags || undefined) : undefined;

isDiffDepsOnly().then(result => {
    setOutput('result', result);
})

function doesDepSatisfyPrefix(dep: string) {
  if (depPrefixRegExpObject) {
    return depPrefixRegExpObject.test(dep);
  }
  return depPrefix ? dep.startsWith(depPrefix) : true;
}

async function isDiffDepsOnly() {
  if (ghToken && context.payload.pull_request) {
    
    const octokit = getOctokit(ghToken)
    const files = await octokit.rest.pulls.listFiles({
        repo: context.repo.repo,
        owner: context.repo.owner,
        pull_number: context.payload.pull_request.number
    })
    log('Diff files', files.data.map(f => f.filename));
    if (files.data.length === 2 && files.data.find(f => f.filename === 'package.json') && files.data.find(f => f.filename === 'package-lock.json')) {
      log('Only files changed are package.json & package-lock.json');
      const oldPkg = await octokit.rest.repos.getContent({
        repo: context.repo.repo,
        owner: context.repo.owner,
        path: 'package.json',
        ref: context.payload.pull_request.base.sha
      })
      const newPkg = await octokit.rest.repos.getContent({
        repo: context.repo.repo,
        owner: context.repo.owner,
        path: 'package.json',
        ref: context.payload.pull_request.head.sha
      });
      //@ts-ignore
      const oldPkgObject = JSON.parse(Buffer.from(oldPkg.data.content, 'base64').toString('utf-8'));
      const oldDeps = oldPkgObject.dependencies;
      const oldDevDeps = oldPkgObject.devDependencies;
      delete oldPkgObject.dependencies;
      delete oldPkgObject.devDependencies;

      //@ts-ignore
      const newPkgObject = JSON.parse(Buffer.from(newPkg.data.content, 'base64').toString('utf-8'));
      const newDeps = newPkgObject.dependencies;
      const newDevDeps = newPkgObject.devDependencies;
      delete newPkgObject.dependencies;
      delete newPkgObject.devDependencies;

      const pkgDiff = diff(oldPkgObject, newPkgObject);
      log('pkgDiff', pkgDiff);
      const isSamePkgExceptForDeps = Object.keys(pkgDiff).length === 0;
      if (!isSamePkgExceptForDeps) {
        return false;
      }
      let isDepsDiffByPrefixOnly = false;
      let isDevDepsDiffByPrefixOnly = false;
      const depsDiffResult = detailedDiff(oldDeps, newDeps);
      log('depsDiffResult', depsDiffResult);
      if (Object.keys(depsDiffResult.added).length === 0 || Object.keys(depsDiffResult.deleted).length === 0) {
        if (Object.keys(depsDiffResult.updated).length > 0) {
          isDepsDiffByPrefixOnly = Object.keys(depsDiffResult.updated).every(doesDepSatisfyPrefix);
        } else {
          isDepsDiffByPrefixOnly = true;
        }
      }
      const devDepsDiffResult = detailedDiff(oldDevDeps, newDevDeps);
      log('devDepsDiffResult', devDepsDiffResult);
      if (Object.keys(devDepsDiffResult.added).length === 0 || Object.keys(devDepsDiffResult.deleted).length === 0) {
        if (Object.keys(devDepsDiffResult.updated).length > 0) {
          isDevDepsDiffByPrefixOnly = Object.keys(devDepsDiffResult.updated).every(doesDepSatisfyPrefix);
        } else {
          isDevDepsDiffByPrefixOnly = true;
        }
      }
      return isDepsDiffByPrefixOnly && isDevDepsDiffByPrefixOnly;
    }
  }
  return false;
}
