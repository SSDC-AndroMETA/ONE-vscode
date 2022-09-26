import * as vscode from 'vscode';
import { obtainWorkspaceRoot } from '../Utils/Helpers';
import { PathToHash } from './pathToHash';

interface Relation{
    "selected": string,
    "relationData": Node[]
}

interface Node{
    "id": string,
    "parent": string,
    "representIdx": number,
    "dataList": Data[]
}

interface Data{
    "path": string,
    "name": string,
    "onecc_version"?: string,
    "toolchain_version"?: string
}

export class Metadata {
    private _disposables: vscode.Disposable[] = [];
    constructor() { }
    public static register(context: vscode.ExtensionContext): void {
        const registrations = [
            vscode.commands.registerCommand('one.metadata.showMetadata', async () => {
                if(vscode.workspace.workspaceFolders === undefined) return;
                const testUri: vscode.Uri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri,"while_000.log"); // 절대경로
                await Metadata.getFileInfo(testUri);
                // await Metadata.getRelationInfo(testUri);
            })
        ];

        registrations.forEach(disposable => {
            context.subscriptions.push(disposable);
        });
    }

    public static async getFileHash(path: string) {
        const instance = await PathToHash.getInstance();
        const hash = instance.getPathToHash(path);
        return hash;
    }

    //get metadata of file by path
    public static async getFileInfo(uri: vscode.Uri) {
        const instance = await PathToHash.getInstance();
        const hash = instance.getPathToHash(uri);
        let metadata = await this.getMetadata(hash);
        return metadata[uri.toString()];
    }

    // deactivate metadata
    public static async disableMetadata(uri: vscode.Uri) {
        const relativePath = vscode.workspace.asRelativePath(uri);
        if(!Metadata.isValidFile(uri)) {
            return;
        }
        
        const pathToHash = await PathToHash.getInstance();
        // step 1. Get hash value from pathToHash
        const hash = pathToHash.getPathToHash(uri);
        if (hash === undefined) {
            return;
        }

        // step 2. Find hash object with hash value
        const metadata = await Metadata.getMetadata(hash);
        if (metadata === undefined) {
            return;
        }

        // step 3. Check if the hash object has the deleted uri
        const data = metadata[relativePath];
        if(data) {
            // step 4. If exists, deactivate (set 'is_deleted') that path.
            metadata[relativePath]["is_deleted"] = true;
            await Metadata.setMetadata(hash, metadata);

            // step 5. Update pathToHash
            pathToHash.deletePath(uri);
        }
    }

    // deactivate all metadata under the folder
    public static async disableMetadataUnderFolder(uri: vscode.Uri) {
        // if it is a folder, deactivate all of its child files
        const pathToHash = await PathToHash.getInstance();
        for(let f of pathToHash.getFilesUnderFolder(uri)) {
            if (!pathToHash.isFile(f)) {
                await Metadata.disableMetadataUnderFolder(f);
            } else if (Metadata.isValidFile(f)) {
                await Metadata.disableMetadata(f);
            }
        }
    }

    public static async moveMetadata(oldUri: vscode.Uri, newUri: vscode.Uri) {
        console.log('Metadata::moveMetadata()===========');
        const oldRelativePath = vscode.workspace.asRelativePath(oldUri);
        const newRelativePath = vscode.workspace.asRelativePath(newUri);
        if(Metadata.isValidFile(oldUri) && !Metadata.isValidFile(newUri)) {
            // when the file is renamed from a valid file name to a invalid file name
            // ex. a.log > a.txt
            await this.disableMetadata(oldUri);
            return;
        } else if(!Metadata.isValidFile(oldUri) || !Metadata.isValidFile(newUri)) {
            return;
        }
        console.log(`moveMetadata:: old: ${oldRelativePath}, new: ${newRelativePath}`);

        // 1. Get hash from pathToHash
        const pathToHash = await PathToHash.getInstance();
        const hash = pathToHash.getPathToHash(oldUri);
        if (hash === undefined) {
            return;
        }

        // 2. Get metadata from the old path
        const metadata = await Metadata.getMetadata(hash);
        // if there is no metadata, should we make a default metadata?
        if (metadata === undefined) {
            return;
        }
        const data = metadata[oldRelativePath];
        if (data === undefined) {
            return;
        }
        
        // 3. Move metadata to the new path
        delete metadata[oldRelativePath];
        metadata[newRelativePath] = data;
        await Metadata.setMetadata(hash, metadata);

        // 4. Update pathToHash
        await pathToHash.addPath(newUri);
        pathToHash.deletePath(oldUri);
    }

    /**
     * Move metadata of the files and folders under the fromUri folder to the toUri folder
     */
    public static async moveMetadataUnderFolder(fromUri: vscode.Uri, toUri: vscode.Uri) {
        console.log(`moveMetadataUnderFolder():`, fromUri, toUri);
        const pathToHash = await PathToHash.getInstance();
        const relativeToPath = vscode.workspace.asRelativePath(toUri);
        const relativeFromPath = vscode.workspace.asRelativePath(fromUri);
        const files = await vscode.workspace.findFiles(`${relativeToPath}/**/*`);
        for(let file of files) {
            const fileToPath = file.path;
            const fileFromUri = vscode.Uri.joinPath(fromUri, fileToPath.substring(fileToPath.lastIndexOf(toUri.path) + toUri.path.length));
            console.log('moveMetadataUnderFolder:: fileFromPath=', fileFromUri);
            if (!pathToHash.isFile(fileFromUri)) {
                await Metadata.moveMetadataUnderFolder(fileFromUri, file);
            } else if (Metadata.isValidFile(file)) {
                await Metadata.moveMetadata(fileFromUri, file);
            }
        }
    }

    public static isValidFile(uri: vscode.Uri): boolean{
        const path = uri.path;
        let ends=['.pb','.onnx','.tflite','.circle','.cfg','.log'];
        return ends.some((x)=>path.endsWith(x));
    }

    //get metadata of file by path
    public static async getRelationInfo(uri: vscode.Uri) {
        const instance = await PathToHash.getInstance();
        const nowHash = instance.getPathToHash(uri);
        if (vscode.workspace.workspaceFolders === undefined) {
            return;
        }

        const relationUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, ".meta/relation.json");
        const relationJSON: any = JSON.parse(Buffer.from(await vscode.workspace.fs.readFile(relationUri)).toString());
        
        // 반환 객체 생성
        const relations: Relation = {
            "selected" :  "",
            "relationData" : []
        };

        // 현재 노드 메타데이터 불러오기

        const nowMetadata: any = await this.getMetadata(nowHash);

        relations.selected = nowHash;

        relations.relationData.push({ "id": nowHash, "parent": relationJSON[nowHash].parent, "representIdx": 0, "dataList": this.getDataList(nowMetadata) });
       
    
        // 부모 노드 찾기
        let tempHash: string = relationJSON[nowHash].parent;
        while (true) {
            
            if (!tempHash) {
                break;
            }
            else {

                const tempMetadata: any = await this.getMetadata(tempHash);
                
                relations.relationData.push({ "id": tempHash, "parent": relationJSON[tempHash].parent, "representIdx": 0, "dataList": this.getDataList(tempMetadata) });
                tempHash = relationJSON[tempHash].parent;
            }
        }

        // 자식 노드 찾기
        let tempHashs: string[] = relationJSON[nowHash].children;
        while (true) {
            let hashs: string[] = [];
            if (tempHashs.length===0) {
                break;
            }
            else {
                
                for (let i = 0; i < tempHashs.length; i++){
                    const tempMetadata: any = await this.getMetadata(tempHashs[i]);
                    
                    relations.relationData.push({ "id": tempHashs[i], "parent": relationJSON[tempHashs[i]].parent, "representIdx": 0, "dataList": this.getDataList(tempMetadata) });
                    hashs = [...relationJSON[tempHashs[i]].children];
                }
                
                tempHashs = hashs;
            }
        }

        console.log(relations);
        
        return relations;

    }

    //get all Metadata of same hash object by hash
    public static async getMetadata(hash: string) {
        if (vscode.workspace.workspaceFolders !== undefined) {
            const metaUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, `.meta/hash_objects/${hash.substring(0, 2)}/${hash.substring(2)}.json`);    
            return JSON.parse(Buffer.from(await vscode.workspace.fs.readFile(metaUri)).toString());
        }
    }

    //set all Metadata of same hash object by hash
    public static async setMetadata(hash: string | undefined, value: object) { //.meta 기준 relative path [=== workspace assert 로직이 필요할 것 같다.]
        const workspaceroot=obtainWorkspaceRoot();
        if(hash){
            const Uri = vscode.Uri.joinPath(vscode.Uri.file(workspaceroot), `.meta/hash_objects/${hash.substring(0, 2)}/${hash.substring(2)}.json`);
            await vscode.workspace.fs.writeFile(Uri,Buffer.from(JSON.stringify(value, null, 4),'utf8'));  // TODO: JSON.stringify(value, null, 4) => 4space? or 2space?
        }
    }

    public static getDataList(metadata: any) {
        const dataList: Data[] = [];
        
        const keys = Object.keys(metadata);
        for (let i = 0; i < keys.length; i++){
            const element = metadata[keys[i]];
            const data: Data = {
                "path": keys[i],
                "name": element.name,
                "onecc_version": element.onecc_version,
                "toolchain_version": element.toolchain_version
            };

            dataList.push(data);
        }

        return dataList;
    }
}


