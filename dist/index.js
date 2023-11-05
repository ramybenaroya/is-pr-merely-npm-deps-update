"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@actions/core");
const github_1 = require("@actions/github");
const deep_object_diff_1 = require("deep-object-diff");
const log = (...args) => {
    console.log('is-pr-merely-npm-deps-update: ', ...args);
};
const ghToken = process.env.GITHUB_TOKEN;
const depPrefix = (0, core_1.getInput)("depPrefix");
const depPrefixRegExp = (0, core_1.getInput)("depPrefixRegExp");
const depPrefixRegExpFlags = (0, core_1.getInput)("depPrefixRegExpFlags");
const depPrefixRegExpObject = depPrefixRegExp ? new RegExp(depPrefixRegExp, depPrefixRegExpFlags || undefined) : undefined;
isDiffDepsOnly().then(result => {
    (0, core_1.setOutput)('result', result);
});
function doesDepSatisfyPrefix(dep) {
    if (depPrefixRegExpObject) {
        return depPrefixRegExpObject.test(dep);
    }
    return depPrefix ? dep.startsWith(depPrefix) : true;
}
async function isDiffDepsOnly() {
    if (ghToken && github_1.context.payload.pull_request) {
        const octokit = (0, github_1.getOctokit)(ghToken);
        const files = await octokit.rest.pulls.listFiles({
            repo: github_1.context.repo.repo,
            owner: github_1.context.repo.owner,
            pull_number: github_1.context.payload.pull_request.number
        });
        log('Diff files', files.data.map(f => f.filename));
        if (files.data.length === 2 && files.data.find(f => f.filename === 'package.json') && files.data.find(f => f.filename === 'package-lock.json')) {
            log('Only files changed are package.json & package-lock.json');
            const oldPkg = await octokit.rest.repos.getContent({
                repo: github_1.context.repo.repo,
                owner: github_1.context.repo.owner,
                path: 'package.json',
                ref: github_1.context.payload.pull_request.base.sha
            });
            const newPkg = await octokit.rest.repos.getContent({
                repo: github_1.context.repo.repo,
                owner: github_1.context.repo.owner,
                path: 'package.json',
                ref: github_1.context.payload.pull_request.head.sha
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
            const pkgDiff = (0, deep_object_diff_1.diff)(oldPkgObject, newPkgObject);
            log('pkgDiff', pkgDiff);
            const isSamePkgExceptForDeps = Object.keys(pkgDiff).length === 0;
            if (!isSamePkgExceptForDeps) {
                return false;
            }
            let isDepsDiffByPrefixOnly = false;
            let isDevDepsDiffByPrefixOnly = false;
            const depsDiffResult = (0, deep_object_diff_1.detailedDiff)(oldDeps, newDeps);
            log('depsDiffResult', depsDiffResult);
            if (Object.keys(depsDiffResult.added).length === 0 || Object.keys(depsDiffResult.deleted).length === 0) {
                if (Object.keys(depsDiffResult.updated).length > 0) {
                    isDepsDiffByPrefixOnly = Object.keys(depsDiffResult.updated).every(doesDepSatisfyPrefix);
                }
                else {
                    isDepsDiffByPrefixOnly = true;
                }
            }
            const devDepsDiffResult = (0, deep_object_diff_1.detailedDiff)(oldDevDeps, newDevDeps);
            log('devDepsDiffResult', devDepsDiffResult);
            if (Object.keys(devDepsDiffResult.added).length === 0 || Object.keys(devDepsDiffResult.deleted).length === 0) {
                if (Object.keys(devDepsDiffResult.updated).length > 0) {
                    isDevDepsDiffByPrefixOnly = Object.keys(devDepsDiffResult.updated).every(doesDepSatisfyPrefix);
                }
                else {
                    isDevDepsDiffByPrefixOnly = true;
                }
            }
            return isDepsDiffByPrefixOnly && isDevDepsDiffByPrefixOnly;
        }
    }
    return false;
}
