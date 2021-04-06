const fs = require('fs').promises;
const path = require('path');

const glob = require('glob-promise');
const { Input, MultiSelect } = require('enquirer');
const childProcess = require('child_process');
const converter = require('json-2-csv');

const utilities = require('./utilities');

const filename = "package-licenses";

async function getAnswer (question, suggestion) {
    const prompt = new Input({
        message: question,
        initial: suggestion,
    });

    return prompt.run();
}

async function getMultiSelect (message, choices) {
    const prompt = new MultiSelect({
        name: 'files',
        message,
        choices
    });

    return prompt.run();
}

const getLicenses = (location) => {
    return new Promise((resolve, reject) => {
        childProcess.exec(`yarn --cwd ${path.relative(__dirname, location.replace('/package.json', ''))} licenses list --json`, (err, stdout, stderr) => {
            if (err) {
                console.log(err);
                return reject(err);
            }
            return resolve(stdout)
        });
    });
};

async function checkPrerequsites () {
    try {
        await fs.access('./export');

        return true;
    } catch (error) {
        await fs.mkdir('./export');
    }
}

async function prepareMetadata (projects) {
    const previousResult = await getPreviosResult();

    const existingPackages = new Set(Object.keys(previousResult));

    let firstParty = [];

    for (const filePath of Object.values(projects)) {
        const packageJson = require(filePath);

        firstParty = [...firstParty, ...Object.keys(packageJson.dependencies ?? {}), ...Object.keys(packageJson.devDependencies ?? {})];
    }

    const firstPartyPackages = new Set(firstParty);

    return {
        existingPackages,
        firstPartyPackages,
        previousResult
    }
}

function getDefaultBranch (packageName) {
    const repositories = ['@babel'];

    return repositories.some(repository => packageName.includes(repository)) ? 'main' : 'master';
}

function modifyRepositoryUrl (url, packageName) {
    const base = url.replace('www.', '')
        .replace('.git', '')
        .replace('git+', '')
        .replace('git://', 'https://')
        .replace('http://', 'https://')
        .replace('ssh://git@', 'https://')
        .replace('ssh://git@', 'https://')
        .replace('git@github.com:', 'https://github.com/')
        .replace('github.com:', 'https://github.com/')
        .replace('git@github.com', 'https://github.com');

    if (!packageName.includes('@') || base.includes('/tree/m')) {
        return { repository: base, packageRepository: '' };
    }

    const packageNameGuess = `${base}/tree/${getDefaultBranch(packageName)}/packages/${packageName.split('/').pop()}`;

    return { repository: base, packageRepository: packageNameGuess };
}

function determinePackageType (packageName, value, metadata) {
    const { existingPackages, previousResult } = metadata;

    if (!existingPackages.has(packageName)) {
        return 'new';
    }

    return utilities.equalValues({
        repository: value.repository,
        license: value.license
    }, {
        repository: previousResult?.[packageName]?.repository,
        license: previousResult?.[packageName]?.license
    }) ? 'old' : 'modified';
}

async function processProject (projectName, filePath, packages, metadata) {
    const { firstPartyPackages } = metadata;

    console.log(`Exporting licenses of ${projectName} from ${filePath}...`);
    const projectLicense = await getLicenses(filePath);

    for (const line of projectLicense.split('\n')) {
        try {
            const jsonLine = JSON.parse(line);

            if (jsonLine.type !== 'table') {
                continue;
            }

            const { body } = jsonLine?.data ?? {};

            for (const license of body) {
                const [packageName, version, licenseType, repositoryUrl] = license;

                const purifiedRepositoryUrl = modifyRepositoryUrl(repositoryUrl, packageName);

                const currentValue = {
                    ...purifiedRepositoryUrl,
                    license: licenseType,
                    firstParty: firstPartyPackages.has(packageName) ? 'yes' : 'no',
                };

                if (packages[packageName]) {
                    if (!packages[packageName].projects.includes(projectName)) {
                        packages[packageName].projects.push(projectName);
                    }
                } else {
                    packages[packageName] = {
                        ...currentValue,
                        projects: [projectName],
                        type: determinePackageType(packageName, currentValue, metadata),
                    }
                }
            }
        } catch (error) {

        }
    }

    return packages;
}

function resolveDeprications (packages, metadata) {
    const { previousResult } = metadata;
    const usedPackages = new Set(Object.keys(packages));

    for (const [packageName, value] of Object.entries(previousResult)) {
        if (!usedPackages.has(packageName)) {
            packages[packageName] = {
                ...value,
                type: 'depricated'
            };
        }
    }

    return packages;
}

async function processProjects (projects) {
    const metadata = await prepareMetadata(projects);

    let packages = {};

    for (const [projectName, filePath] of Object.entries(projects)) {
        packages = await processProject(projectName, filePath, packages, metadata);
    }

    packages = resolveDeprications(packages, metadata);

    return packages;
}

async function getPreviosResult () {
    try {
        const content = await fs.readFile(`export/${filename}.json`);

        return JSON.parse(content);
    } catch (error) {
        try {
            const content = await fs.readFile(`export/package-licences.json`);

            return JSON.parse(content);
        } catch (error) {
            return {};
        }
    }
}

function getParentJSONPackageFiles () {
    return glob(__dirname + '/../**/package.json', {
        ignore: [__dirname + '/../**/node_modules/**', __dirname + '/*'],
    });
}

async function getAnwsersWithNames (choices) {
    const selected = await getMultiSelect('Which package.json files you would like to export?', choices)
    const projectNames = {};

    for (const file of selected) {
        const { name } = require(file);

        const anwser = await getAnswer(`What is project name for ${file}?`, name);
        projectNames[anwser] = file;
    }

    return {
        anwsers: selected,
        projectNames
    };
}

async function exportToJson (packages) {
    return fs.writeFile(`export/${filename}.json`, JSON.stringify(packages), 'utf8');
}

async function exportToCSV (packages) {
    const keys = Object.keys(packages).sort();

    const exportArray = keys.map(key => {
        return {
            ...packages[key],
            projects: packages[key].projects.join(', '),
            package: key
        };
    })

    const csv = await converter.json2csvAsync(exportArray, {
        keys: ['package', 'projects', 'license', 'repository', 'packageRepository', 'firstParty', 'type']
    });

    await fs.writeFile(`export/${filename}.csv`, csv, 'utf8');
}

async function exportData (packages) {
    await exportToJson(packages);
    await exportToCSV(packages);
}

async function exportLicences () {
    await checkPrerequsites();

    const choices = await getParentJSONPackageFiles();

    const { projectNames } = await getAnwsersWithNames(choices);

    const finalPackages = await processProjects(projectNames);

    await exportData(finalPackages);
}

exportLicences()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);

        process.exit(1);
    });
