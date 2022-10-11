// /*
//  * Copyright (c) 2022 Samsung Electronics Co., Ltd. All Rights Reserved
//  *
//  * Licensed under the Apache License, Version 2.0 (the "License");
//  * you may not use this file except in compliance with the License.
//  * You may obtain a copy of the License at
//  *
//  *    http://www.apache.org/licenses/LICENSE-2.0
//  *
//  * Unless required by applicable law or agreed to in writing, software
//  * distributed under the License is distributed on an "AS IS" BASIS,
//  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//  * See the License for the specific language governing permissions and
//  * limitations under the License.
//  */

// import { assert } from 'chai';
// import * as vscode from 'vscode';
// import { Relation } from '../../MetadataManager/Relation';
// import { TestBuilder } from '../TestBuilder';
// import * as fs from 'fs';

// const emptyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
// const childName = 'child.circle';

// suite('MetadataManager', function() {
//   suite('Relation', function() {
//     this.timeout(15000);
//     let testBuilder: TestBuilder;
//     setup(() => {
//       testBuilder = new TestBuilder(this);
//       testBuilder.setUp();
//     });

//     teardown(() => {
//       testBuilder.tearDown();
//     });

//     suite('#getRelationInfo', function() {
//       test('get relation information for an unsaved path with metadata', async function() {
//         const childPath = testBuilder.getPath(childName, 'workspace');
//         testBuilder.writeFileSync(childName, 'test', 'workspace');
//         const childUri = vscode.Uri.file(childPath);
//         const childRelPath = vscode.workspace.asRelativePath(childUri);
//         const relInfo = await Relation.getRelationInfo(childUri);
//         console.log(relInfo);
//         assert.isNotEmpty(relInfo);
//         // assert.property(relInfo, childRelPath);
//         // assert.equal(relInfo[childRelPath]['selected'], '0');
//         // assert.nestedProperty(relInfo, 'relation-data');
//       });

//       test('get relation information for a saved path with metadata', async function() {
//         const childPath = testBuilder.getPath(childName, 'workspace');
//         const parentPath = testBuilder.getPath('parent.circle', 'workspace');
        
//         const childUri = vscode.Uri.file(childPath);
//         Relation.store(childPath, parentPath);
//         const relInfo = await Relation.getRelationInfo(childUri);
//         assert.property(relInfo, 'selected');
//         assert.nestedProperty(relInfo, 'relation-data');
//         // assert.ok(relInfo['relation-data'] as any);
//         // const relData = relInfo['relation-data'];
//       });

//       test('NEG: get relation information for a path without metadata', async function() {
//         const childPath = testBuilder.getPath('child.circle', 'workspace');
//         const childUri = vscode.Uri.file(childPath);
//         const relInfo = await Relation.getRelationInfo(childUri);
//         assert.isUndefined(relInfo);
//       });

//       test('NEG: get relation information for a saved path without metadata', async function() {
//         const childPath = testBuilder.getPath('child.circle', 'workspace');
//         const parentPath = testBuilder.getPath('parent.circle', 'workspace');
        
//         const childUri = vscode.Uri.file(childPath);
//         Relation.store(childPath, parentPath);
//         const relInfo = await Relation.getRelationInfo(childUri);
//         assert.property(relInfo, 'selected');
//         assert.nestedProperty(relInfo, 'relation-data');
//         // assert.ok(relInfo['relation-data'] as any);
//         // const relData = relInfo['relation-data'];
//       });

//       test('NEG: get relation information for a non-existing path', async function() {
//         const childPath = testBuilder.getPath('child.circle', 'workspace');
//         const parentPath = testBuilder.getPath('parent.circle', 'workspace');
//         console.log('childPath', childPath);
//         const childUri = vscode.Uri.file(childPath);
//         console.log(vscode.workspace.asRelativePath(childUri));
//         Relation.store(childPath, parentPath);
//         const relInfo = await Relation.getRelationInfo(childUri);
//         assert.property(relInfo, 'selected');
//         assert.nestedProperty(relInfo, 'relation-data');
//         // assert.ok(relInfo['relation-data'] as any);
//         // const relData = relInfo['relation-data'];
//       });
//     });


//     // suite('#updateFile', function() {

//     // });
    
//     // suite('#getRelationInfo', function() {

//     // });

//     // suite('#saveJson', function() {

//     // });

//     // suite('#readJson', function() {

//     // });
//   });
// });
