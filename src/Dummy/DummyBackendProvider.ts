import {Backend} from '../Backend/Backend';
import {Command} from '../Backend/Command';
import {Compiler} from '../Backend/Compiler';
import {Executor} from '../Backend/Executor';
import {Toolchain, ToolchainInfo, Toolchains} from '../Backend/Toolchain';
import {backendRegistrationApi} from '../Backend/API'
import {DeviceSpec} from '../Backend/Spec';
import {Version} from '../Backend/Version';
import * as fs from 'fs';


const which = require('which');

class DummyBackend implements Backend {
  private static _name = "dummy backend";

  name(): string {
    return DummyBackend._name;
  }
  compiler(): Compiler | undefined {
    return new DummyCompiler();
  }
  executor(): Executor | undefined {
    return new DummyExecutor();
  }
  executors(): Executor[] {
    return [new DummyExecutor()];
  }
}

class DummyCompiler implements Compiler {
  getToolchainTypes(): string[] {
    return ['officially'];
  }
  getToolchains(toolchainType: string, start: number, count: number): Toolchains {
    const array = new Array<Toolchain>();
    const toolchainInfo = new ToolchainInfo("metadata toolchain", "Toolchain for metadata", new Version(1, 2, 3));
    array.push(new MetadataToolchain(toolchainInfo));
    return array;
    // const array = new Array<Toolchain>();
    // const toolchainInfo = new ToolchainInfo("dummy toolchain", "dummy!!!!", new Version(1, 2, 3));
    // array.push(new DummyToolchain(toolchainInfo));
    // return array;
  }
  getInstalledToolchains(toolchainType: string): Toolchains {
    const array = new Array<Toolchain>();
    const toolchainInfo = new ToolchainInfo("metadata toolchain", "Toolchain for metadata", new Version(1, 2, 3));
    array.push(new MetadataToolchain(toolchainInfo));
    return array;
    // const array = new Array<Toolchain>();
    // const toolchainInfo = new ToolchainInfo("dummy toolchain", "dummy!!!!", new Version(1, 2, 3));
    // array.push(new DummyToolchain(toolchainInfo));
    // return array;
  }
  prerequisitesForGetToolchains(): Command {
    return new Command('prerequisitesForGetToolchains');
  }
}

class DummyExecutor implements Executor {
  name(): string {
    return "dummy executor"
  }
  getExecutableExt(): string[] {
    return ['.cfg', '.pb', '.tflite', 'onnx'];
  }
  toolchains(): Toolchains {
    const array = new Array<Toolchain>();
    const toolchainInfo = new ToolchainInfo("metadata toolchain", "Toolchain for metadata", new Version(1, 2, 3));
    array.push(new MetadataToolchain(toolchainInfo));
    return array;
  }
  runInference(_modelPath: string, _options?: string[] | undefined): Command {
    return new Command('runInference');
  }
  require(): DeviceSpec {
    return new DeviceSpec("hw", 'sw', undefined);
  }
}

class DummyToolchain extends Toolchain {
  run(_cfg: string): Command {
    console.log('dummy toolchain:: run');
    let oneccPath = which.sync('onecc', {nothrow: true});
    if (oneccPath === null) {
      console.log('no onecc');
      // Use fixed installation path
      oneccPath = '/home/one/onecc_test/bin/onecc';
    } else {
      console.log(oneccPath);
    }
    let oneccRealPath = fs.realpathSync(oneccPath);
    return new Command(oneccRealPath, ['-C', _cfg]);
  }
}

class MetadataToolchain extends Toolchain {
  run(_cfg: string): Command {
    console.log('MetadataToolchain:: run');
    // find onecc path (can find only if it is installed from debian pkg)
    let oneccPath = which.sync('onecc', {nothrow: true});
    if (oneccPath === null) {
      console.log('no onecc');
      // Use fixed installation path
      oneccPath = '/home/one/onecc_test/bin/onecc';
    }


    const oneccRealPath = fs.realpathSync(oneccPath);
    return new Command(oneccRealPath, ['-C', _cfg]);
  }
}

export class DummyBackendProvider {
  public static register() {
    const backend = new DummyBackend();
    // const backRegExt = vscode.extensions.getExtension('Samsung.one-vscode');
    // backRegExt?.exports(backend);
    backendRegistrationApi().registerBackend(backend);
  }
}
