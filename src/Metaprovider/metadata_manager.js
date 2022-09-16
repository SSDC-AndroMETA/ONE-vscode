"use strict";
exports.__esModule = true;
exports.getMetadata = void 0;
var vscode = require("vscode");
// export class MetadataAPI {
// }
function getMetadata(path, context) {
    // 해쉬값으로 변경하는 방법 미정
    var hash = "9f8641056d4e2eb03830f3c1bbb6c71ca6e820f6da94bf7055b132b8d2e6a2b5";
    var metaUri = vscode.Uri.joinPath(context.extensionUri, ".meta/".concat(hash.substring(0, 2), "/").concat(hash.substring(2), ".json"));
    var html = Buffer.from(vscode.workspace.fs.readFile(metaUri)).toString();
    console.log(html);
    // pathToHash.json 맵 형태로 변경
    // pathToHash Map을 통해 경로를 hash값으로 매핑
    // 해당 hash값을 가지고 hash_objects를 탐색해서 hash.json 파일 가져오기
    // hash.json 파일을 파싱해서 원하는 템플릿으로 리턴 
    // let pathToHashMap = pathToHashJSON에서 가져온 파일
    // let metadata: JSON = rootPath+pathToHashMap
}
exports.getMetadata = getMetadata;
// getMetadata("asfasfsdf");
