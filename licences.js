const glob = require('glob');
const fs = require('fs');
const path = require('path');
const CheckboxPrompt = require('prompt-checkbox');
const textprompt = require('text-prompt');
const childProcess = require('child_process');
const converter = require('json-2-csv');

const TextPrompt = (question) => {
    return new Promise((resolve, reject) => {
        textprompt(question)
            .on('submit', (v) => resolve(v))
            .on('abort', (err) => reject(err))

    });
};

const getLicences = (location) => {
    return new Promise((resolve, reject) => {
        childProcess.exec(`cd ${path.relative(__dirname, location.replace('/package.json', ''))} && yarn licenses list --json`, (err, stdout, stderr) => {
            if (err) {
                console.log(err);
                return reject(err);
            }
            return resolve(stdout)
        })
    })
};

const filename = "package-licences";
let packages = {};

glob(__dirname + '/../**/package.json', {
    ignore: [__dirname + '/../**/node_modules/**', __dirname + '/*'],
}, (err, files) => {
    fs.readFile(`export/${filename}.json`, (err, res) => {
        if (!err && res) {
            packages = JSON.parse(res);
        }
        const checkbox = new CheckboxPrompt({
            name: 'files',
            message: 'Which package.json files you would like to export',
            choices: files
        });
        checkbox.run()
            .then(async (selectedFiles) => {
                const projects = {};
                for (const file of selectedFiles) {
                    const name = await TextPrompt(`What is project name for ${file}`);
                    projects[name] = file;
                }
                Object.keys(packages).map((name) => {
                    packages[name].type = 'old';
                });
                for (const name of Object.keys(projects)) {
                    console.log(`Exporting licences of ${name}...`);
                    const licences = await getLicences(projects[name]);
                    licences.split('\n').forEach((line) => {
                        try {
                            let parsed = JSON.parse(line);
                            if (!!parsed.data.body && !!parsed.data.head) {
                                parsed.data.body.forEach((pkginfo) => {
                                    let [pkg, version, license, repository] = pkginfo;
                                    repository = repository
                                        .replace('www.', '')
                                        .replace('.git', '')
                                        .replace('git+', '')
                                        .replace('git://', 'https://')
                                        .replace('http://', 'https://')
                                        .replace('ssh://git@', 'https://')
                                        .replace('ssh://git@', 'https://')
                                        .replace('git@github.com:', 'https://github.com/')
                                        .replace('github.com:', 'https://github.com/')
                                        .replace('git@github.com', 'https://github.com');
                                    if (pkg in packages) {
                                        if (!packages[pkg].projects.includes(name)) {
                                            packages[pkg].projects.push(name);
                                        }
                                        packages[pkg].type = 'used';
                                    }
                                    else {
                                        packages[pkg] = {
                                            projects: [name],
                                            license,
                                            repository,
                                            firstParty: 'no',
                                            type: 'new',
                                        };
                                    }
                                });
                            }
                        } catch (e) {}
                    });
                    await new Promise ((resolve, reject) => {
                        fs.readFile(projects[name], (err, res) => {
                            if (!err && res) {
                                const pkg = JSON.parse(res);
                                const firstParty = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies)];
                                firstParty.forEach((fpPackage) => {
                                    packages[fpPackage].firstParty = 'yes';
                                });
                                return resolve();
                            }
                            return reject(err);
                        });
                    });
                    console.log(`Finished export for ${name}`);
                }
                if (!fs.existsSync('./export')){
                    await fs.mkdirSync('./export');
                }
                fs.writeFile(`export/${filename}.json`, JSON.stringify(packages), () => {});
                Object.keys(packages).map((name) => {
                    packages[name].projects = packages[name].projects.join(', ');
                });
                const packageArray = [];
                Object.keys(packages).map((name) => {
                    packages[name].package = name;
                    packageArray.push(packages[name]);
                });
                converter.json2csv(packageArray, (err, csv) => {
                    if (err) {
                        throw err;
                    }
                    fs.writeFile(`export/${filename}.csv`, csv, () => {});
                    console.log("All licences exported into /export folder!")
                }, {
                    keys: [
                        'package',
                        'projects',
                        'license',
                        'repository',
                        'firstParty',
                        'type',
                    ]
                });
            })
            .catch(function (err) {
                console.log(err)
            })
    });

});
