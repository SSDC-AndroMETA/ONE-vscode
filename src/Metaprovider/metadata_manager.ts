import * as vscode from 'vscode';

interface Relation{
    "selected": string,
    "relationData": Node[]
}

interface Node{
    "id": string,
    "parent": string,
    "represent": number,
    "dataList": Data[]
}

interface Data{
    "path": string,
    "name": string,
    "onecc_version"?: string,
    "toolchain_version"?: string
}

export class Metadata{

    private _disposables: vscode.Disposable[] = [];
    constructor() { }
    public static register(context: vscode.ExtensionContext): void {
        const registrations = [
            vscode.commands.registerCommand('one.metadata.showMetadata', async () => {

                const testPath :string = "./model.tflite" // workspace 기준 실제 파일 위치
                // await Metadata.getMetadata(context, testPath);
                await Metadata.getRelation(context, testPath);
            })
        ]

        registrations.forEach(disposable => {
            context.subscriptions.push(disposable);
        });
    }

    
    public static getMetadata(context: vscode.ExtensionContext, uri: string) {
        // uri를 통해 hash 값 가져오는 로직 필요 




        // - pathToHash 의 접근 방식 미정으로 예시 hash 파일 설정
        const hash = "9f8641056d4e2eb03830f3c1bbb6c71ca6e820f6da94bf7055b132b8d2e6a2b5"
        
        return this.hashToMetadata(hash)

    }

    public static async hashToMetadata (hash: string) {
        const metaUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, `.meta/hash_objects/${hash.substring(0, 2)}/${hash.substring(2)}.json`);
        return  JSON.parse(Buffer.from(await vscode.workspace.fs.readFile(metaUri)).toString())
    }

    public static async getRelation(context: vscode.ExtensionContext, uri: string) {
        //uri를 통해 hash값 가져오는 로직 필요

        const nowHash = "9f8641056d4e2eb03830f3c1bbb6c71ca6e820f6da94bf7055b132b8d2e6a2b5"

        // relation.json 불러오기
    
        let relationUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri,".meta/relation.json")
        let relationJSON: JSON = JSON.parse(Buffer.from(await vscode.workspace.fs.readFile(relationUri)).toString())
        
        console.log(relationJSON)
        // 반환 객체 생성
        let relations: Relation = {
            "selected" :  "",
            "relationData" : []
        }

        // 현재 노드 메타데이터 불러오기

        let nowMetadata: JSON = this.hashToMetadata(nowHash);

        console.log(nowMetadata)

        relations.selected = nowHash
        let dataList: Data[] =[]
        let keys = Object.keys(nowMetadata)
        for (let i = 0; i < keys.length; i++){
            let element = nowMetadata[keys[i]]
            let data: Data = {
                "path": element.path,
                "name": element.name,
                "onecc_version": element.onecc_version,
                "toolchain_version": element.toolchain_version
            }

            dataList.push(data);
        }

        console.log(dataList)

        relations.relationData.push({ "id": nowHash, "parent": relationJSON[nowHash].parent, "represent": 0, "dataList": dataList })
        
        console.log(relations)
        

        // 부모 노드 찾기
        let tempHash = relationJSON[nowHash].parent
        while (true) {

            if (tempHash == "") {
                break;
            }
            else {
                let dataList: Data[] =[]
                let keys = Object.keys(nowMetadata)
                for (let i = 0; i < keys.length; i++){
                    let element = nowMetadata[keys[i]]
                    let data: Data = {
                        "path": element.path,
                        "name": element.name,
                        "onecc_version": element.onecc_version,
                        "toolchain_version": element.toolchain_version
                    }
        
                    dataList.push(data);
                }
            }
        }

        // 자식 노드 찾기

        

    }

    
}


