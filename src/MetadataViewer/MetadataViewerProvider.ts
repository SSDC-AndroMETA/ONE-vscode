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
import { Metadata } from '../MetadataManager/Metadata';
import { PathToHash } from '../MetadataManager/PathToHash';
import { MetadataViewer } from './MetadataViewer';

export class RelationViewerDocument implements vscode.CustomDocument {
  private readonly _uri: vscode.Uri;
  private _metadataViwer: MetadataViewer[];


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

  public openView(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, fileUri: vscode.Uri) {
    let view = new MetadataViewer(panel, extensionUri);

    view.initWebView();
    view.loadContent();
    this._metadataViwer.push(view);

    //메타데이터 정보를 가져오는 로직(Uri 인자를 이용하면 됨)
    getMetadata(fileUri).then((metadata: any) => {
      const payload: any = {};
      payload[metadata['name']] = metadata;
      console.log(metadata);
      //패널 타이틀 변경(적용되지 않음)
      //panel.title = `Metadata: ${this._getNameFromPath(fileUri.toString())}`;
      
      //가져온 메타데이터를 웹뷰로 메세지를 보낸다.
      panel.webview.postMessage({command:'showMetadata',metadata: payload});
    });

    
    

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

export class MetadataViewerProvider implements
    vscode.CustomReadonlyEditorProvider<RelationViewerDocument> {
  public static readonly viewType = 'one.viewer.metadata';

  private _context: vscode.ExtensionContext;

  public static register(context: vscode.ExtensionContext): void {
    const provider = new MetadataViewerProvider(context);

    const registrations = [
      vscode.window.registerCustomEditorProvider(MetadataViewerProvider.viewType, provider, {
        webviewOptions: {
          retainContextWhenHidden: true,
        }
      }),
      vscode.commands.registerCommand(
          'one.viewer.metadata.showFromOneExplorer',
          async (uri) => {
            // If the method is executed in the ONE Explorer, change the uri instance.
            const fileUri = uri.uri;

            vscode.commands.executeCommand(
                'vscode.openWith', fileUri, MetadataViewerProvider.viewType);
          }),
      vscode.commands.registerCommand(
          'one.viewer.metadata.showFromDefaultExplorer',
          async (uri) => {
            const fileUri = uri;

            vscode.commands.executeCommand(
                'vscode.openWith', fileUri, MetadataViewerProvider.viewType);
          })
      // Add command registration here
    ];

    // supported file extension to show relations context menu
    vscode.commands.executeCommand(
        'setContext', 'one.metadata.supportedFiles',
        ['.tflite', '.pb', '.onnx', '.circle', '.log']);

    registrations.forEach(disposable => context.subscriptions.push(disposable));
  }

  constructor(private readonly context: vscode.ExtensionContext) {
    this._context = context;
  }

  // CustomReadonlyEditorProvider implements
  async openCustomDocument(
      uri: vscode.Uri, _openContext: {backupId?: string},
      _token: vscode.CancellationToken): Promise<RelationViewerDocument> {
    const document: RelationViewerDocument = await RelationViewerDocument.create(uri);
    // NOTE as a readonly viewer, there is not much to do

    return document;
  }

  // CustomReadonlyEditorProvider implements
  async resolveCustomEditor(
      document: RelationViewerDocument, webviewPanel: vscode.WebviewPanel,
      _token: vscode.CancellationToken): Promise<void> {
    document.openView(webviewPanel, this._context.extensionUri, document.uri);
  }
}

async function getMetadata(uri: vscode.Uri) {
  const instance = await PathToHash.getInstance();
  const hash = instance.getHash(uri);
  const entry = await Metadata.getEntry(uri, hash);
  return entry;
}
