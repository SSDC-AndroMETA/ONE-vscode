/*
 * Copyright (c) 2022 Samsung Electronics Co., Ltd. All Rights Reserved
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as vscode from 'vscode';
import { Node } from '../OneExplorer/OneExplorer';
import { RelationViewer } from './RelationViewer';


export class RelationViewerDocument implements vscode.CustomDocument {
  private readonly _uri: vscode.Uri;
  private _metadataViwer: RelationViewer[];
  

  static async create(uri: vscode.Uri):
      Promise<RelationViewerDocument|PromiseLike<RelationViewerDocument>> {
    return new RelationViewerDocument(uri);
  }

  private constructor(uri: vscode.Uri) {
    this._uri = uri;
    this._metadataViwer = [];
    
  }

  public get uri() {
    return this._uri;
  }

  // CustomDocument implements
  dispose(): void {
    // NOTE panel is closed before document and this is just for safety
    this._metadataViwer.forEach((view) => {
      while (this._metadataViwer.length) {
        view.disposeMetadataView();
      }
    });
    this._metadataViwer = [];
  }

  public openView(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, fileUri:vscode.Uri) {
    let view = new RelationViewer(panel,extensionUri);

    view.initRelationViewer();
    view.loadContent();
    this._metadataViwer.push(view);

    //get Relative_Path
    //const relativePath:string = vscode.workspace.asRelativePath(fileUri);
    
    const payload = getRelationData(fileUri);

    // Send a message the relation data to the web view 
    panel.webview.postMessage(
      {type:'create',payload: payload}
    );
    
    panel.onDidDispose(() => {
      // TODO make faster
      this._metadataViwer.forEach((view, index) => {
        if (view.owner(panel)) {
          view.disposeMetadataView();
          this._metadataViwer.splice(index, 1);
        }
      });
    });

    return view;
  }
}

export class RelationViewerProvider implements
    vscode.CustomReadonlyEditorProvider<RelationViewerDocument> {
  public static readonly viewType = 'one.viewer.relation';

  private _context: vscode.ExtensionContext;

  public static register(context: vscode.ExtensionContext): void {
    const provider = new RelationViewerProvider(context);

    const registrations = [
      vscode.window.registerCustomEditorProvider(RelationViewerProvider.viewType, provider, {
        webviewOptions: {
          retainContextWhenHidden: true,
        }
      }),
      vscode.commands.registerCommand('one.relation.showRelationViewer', async (uri) => {
        //If the method is executed in the ONE explorer, change the uri.
        let fileUri = uri;
        if(uri instanceof Node){
          fileUri = uri.uri;
        }
        
        vscode.commands.executeCommand('vscode.openWith', fileUri, RelationViewerProvider.viewType);
      })
      // Add command registration here
    ];
    
    // supported file extension to show relations context menu
    vscode.commands.executeCommand('setContext', 'relation.supportedFiles', [
      '.tflite',
      '.pb',
      '.onnx',
      '.circle',
      '.log'  
    ]);

    registrations.forEach(disposable => context.subscriptions.push(disposable));
  }

  constructor(private readonly context: vscode.ExtensionContext) {
    this._context = context;
  }

  // CustomReadonlyEditorProvider implements
  async openCustomDocument(
      uri: vscode.Uri, openContext: {backupId?: string},
      _token: vscode.CancellationToken): Promise<RelationViewerDocument> {
    const document: RelationViewerDocument = await RelationViewerDocument.create(uri);
    // NOTE as a readonly viewer, there is not much to do

    // TODO handle dispose
    // TODO handle file change events
    // TODO handle backup

    return document;
  }

  // CustomReadonlyEditorProvider implements
  async resolveCustomEditor(
      document: RelationViewerDocument, webviewPanel: vscode.WebviewPanel,
      _token: vscode.CancellationToken): Promise<void> {
    document.openView(webviewPanel, this._context.extensionUri, document.uri);
  }
}

export function getRelationData(path:any) {
  
  const dummyData = {
    "selected": "1",
    "relation-data": [
      {"id": "1", "parent": "", "represent-idx": 0, "data-list": [{"name": "baseModelTestTflite123123.tflite", "path": "baseModelTestTflite123123.tflite", "is-deleted":false},{"name": "model.tflite", "path": "model.tflite", "is-deleted":true},{"name": "c.tflite", "path": "c.tflite"},{"name": "d.tflite", "path": "d.tflite", "is-deleted":false}]},  // TODO: id, parentid: hashId
      {"id": "2", "parent": "1", "represent-idx": 0, "data-list": [{"name": "test1.circle", "path": "src/hello/test1.circle", "onecc-version": "1.0.0", "toolchain-version": "1.0.0", "is-deleted":false}]},
      {"id": "3", "parent": "2", "represent-idx": 0, "data-list": [{"name": "test2.circle", "path": "src/trudiv/model/test2.circle", "onecc-version": "1.0.0", "toolchain-version": "1.0.0", "is-deleted":false}]},
      {"id": "4", "parent": "1", "represent-idx": 0, "data-list": [{"name": "test1.log", "path": "test1.log", "onecc-version": "1.0.0", "toolchain-version": "1.0.0", "is-deleted":false}]},
      {"id": "5", "parent": "2", "represent-idx": 0, "data-list": [{"name": "test2.log", "path": "test2.log", "toolchain-version": "1.0.0", "is-deleted":false}]},
      {"id": "6", "parent": "4", "represent-idx": 0, "data-list": [{"name": "baseModelTestCircle.circle", "path": "baseModelTestCircle.circle", "is-deleted":false}]},
      {"id": "7", "parent": "6", "represent-idx": 0, "data-list": [{"name": "model.q8.circle", "path": "model.q8.circle", "onecc-version": "1.0.0", "toolchain-version": "1.0.0", "is-deleted":false}]},
      {"id": "8", "parent": "6", "represent-idx": 0, "data-list": [{"name": "pbTestCircle1.log", "path": "pbTestCircle1.log", "onecc-version": "1.0.0", "toolchain-version": "1.0.0", "is-deleted":false}]},
      {"id": "9", "parent": "7", "represent-idx": 0, "data-list": [{"name": "test_onnx.circle", "path": "hello/test_onnx.circle", "toolchain-version": "1.0.0", "is-deleted":false}]},
      {"id": "10", "parent": "7", "represent-idx": 0, "data-list": [{"name": "while_000.circle", "path": "while/while_000.circle", "onecc-version": "1.0.0", "toolchain-version": "1.0.0", "is-deleted":false}]},
      {"id": "11", "parent": "8", "represent-idx": 0, "data-list": [{"name": "e1.log", "path": "e1.circle", "onecc-version": "1.0.0", "toolchain-version": "1.0.0", "is-deleted":false}]},
      {"id": "12", "parent": "8", "represent-idx": 0, "data-list": [{"name": "e2.log", "path": "e2.circle", "onecc-version": "1.0.0", "toolchain-version": "1.0.0", "is-deleted":true},{"name": "e3.circle", "path": "e3.circle", "onecc-version": "1.2.0", "toolchain-version": "1.0.0", "is-deleted":false}]}
    ]
  } as any;

  for (const key in dummyData) {
    if(key === 'relation-data'){
      for (const idx in dummyData['relation-data']) {
        for (const key2 in dummyData['relation-data'][idx]) {
            if(key2 === 'data-list'){
              for (let index = 0; index < dummyData['relation-data'][idx]['data-list'].length; index++) {
                const element = dummyData['relation-data'][idx]['data-list'][index];
                for (const key3 in element) {
                  if(key3 === 'path'){
                    if(element['path'] === path){
                      dummyData['relation-data'][idx]['represent-idx'] = index;
                      dummyData['selected'] = dummyData['relation-data'][idx]['id'];
                    }
                  }
                }
              }
            }
        }
      }
    }
  }

  return dummyData;
}