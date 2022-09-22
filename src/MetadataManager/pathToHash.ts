import { obtainWorkspaceRoot } from '../Utils/Helpers';
import * as vscode from 'vscode';

export class PathToHash{
    
    private static instance: PathToHash;

    private constructor() {
        this.pathToHash = PathToHash.initPathToHash();
    }
    
    public pathToHash: any;
    
    private static async initPathToHash() {
        // let workspaceroot = obtainWorkspaceRoot();
        if (vscode.workspace.workspaceFolders === undefined) {
            return;
        }
        let uri = vscode.workspace.workspaceFolders[0].uri;
        // console.log(vscode.Uri.joinPath(uri, `/.meta`));
        let arrayList = await vscode.workspace.fs.readDirectory(uri);


        let obj = new Map();
        arrayList.forEach(async (array) => {
            const name = array[0];
            let type = array[1];
            // console.log(name, type);
            // let obj: { [key: string]: any } = { }
            
            if (array[1] === 1) {// 파일인 경우
                obj.set(array[0], "hash");
                
                // temp.push(obj)
                // temp = Object.assign(temp, obj);

                
                // temp = {...temp, array[0]:"hash"}
            }

            else if (array[1] === 2 && array[0] !== '.meta') {// 폴더인 경우
                let result = await PathToHash.rec(vscode.Uri.joinPath(uri, "/" + name));
                obj.set(array[0], result);
                // Object.assign(temp, { name: result });
            }
            // console.log(array)
        });

        return obj;
        // console.log(obj);
        // console.log(obj.keys());
        // console.log(obj.get('testfolder'));
        // console.log(obj.get('2').get('3').get('testest.circle'));

        // console.log("=====================");
        // console.log(123,temp);
    }

    public static async rec(uri: vscode.Uri) {
        let obj = new Map();
        let arrayList = await vscode.workspace.fs.readDirectory(uri);
        // console.log(arrayList);

        arrayList.forEach(async (array) => {
            const name = array[0];
            let type = array[1];

            if (array[1] === 1) {// 파일인 경우
                obj.set(array[0], "hash");
            } else if (array[1] === 2 && array[0] !== '.meta') {// 폴더인 경우
                let result = await PathToHash.rec(vscode.Uri.joinPath(uri, "/" + name));
                obj.set(array[0], result);
           }
        });

        return obj;
    }

    

    public static getPathToHash() {
        if (!PathToHash.instance) {
            PathToHash.instance = new PathToHash();
        }
        return PathToHash.instance;
    }

}