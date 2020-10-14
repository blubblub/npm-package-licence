const glob = require('glob');
const CheckboxPrompt = require('prompt-checkbox');
const textprompt = require('text-prompt');

const TextPrompt = (question) => {
    return new Promise((resolve, reject) => {
        textprompt(question)
            .on('submit', (v) => resolve(v))
            .on('abort', (err) => reject(err))

    });
};

const filename = "export-packages.json";
const packages = {};

glob(__dirname + '/../**/package.json', {
    ignore: [__dirname + '/../**/node_modules/**', __dirname + '/*'],
}, (err, files) => {
    console.log(files);
    const checkbox = new CheckboxPrompt({
        name: 'files',
        message: 'Which package.json files you would like to export',
        choices: files
    });
    checkbox.run()
        .then(async (selectedFiles) => {
            const projects = {};
            for(const file of selectedFiles){
                const name = await TextPrompt(`What is project name for ${file}`);
                projects[name] = file;
            }
            for(const name of Object.keys(projects)){
                console.log(name);
            }
            console.log(projects);
            // selectedFiles.forEach((file) => {
            //     console.log(file);
            //     return TextPrompt(file);
            // });

        })
        .catch(function (err) {
            console.log(err)
        })
});

// let project = "Service";
// const filename = "export-packages.json";
// let packages = {};
//
// fs.readFile(filename, (err, res) => {
//     if(!err && res){
//         packages = JSON.parse(res);
//     }
//
//
//     require('child_process').exec('yarn licenses list --json', function (err, stdout, stderr) {
//         stdout.split('\n').forEach((line) => {
//             try {
//                 let parsed = JSON.parse(line);
//                 if (!!parsed.data.body && !!parsed.data.head) {
//                     parsed.data.body.forEach((pkginfo) => {
//                         let [pkg, version, license, repository] = pkginfo;
//                         repository = repository
//                             .replace('www.', '')
//                             .replace('.git', '')
//                             .replace('git+', '')
//                             .replace('git://', 'https://')
//                             .replace('http://', 'https://')
//                             .replace('ssh://git@', 'https://')
//                             .replace('ssh://git@', 'https://')
//                             .replace('git@github.com:', 'https://github.com/')
//                             .replace('github.com:', 'https://github.com/')
//                             .replace('git@github.com', 'https://github.com');
//                         if(pkg in packages){
//                             if(!packages[pkg].projects.includes(project)){
//                                 packages[pkg].projects.push(project);
//                             }
//                         }
//                         else{
//                             packages[pkg] = {
//                                 projects: [project],
//                                 license,
//                                 repository,
//                             };
//                         }
//                     });
//                     fs.writeFile(filename, JSON.stringify(packages), () => {})
//                 }
//             } catch (e) {
//
//             }
//         })
//     });
// });




