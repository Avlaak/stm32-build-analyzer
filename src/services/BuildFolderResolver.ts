import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface BuildPaths {
  map: string;
  elf: string;
  toolchainPath?: string;
}

export class BuildFolderResolver {
  private readonly debug: boolean;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.debug = vscode.workspace
      .getConfiguration('stm32BuildAnalyzerEnhanced')
      .get<boolean>('debug') ?? false;
  }

  public async resolve(): Promise<BuildPaths> {
    const cfg = vscode.workspace.getConfiguration('stm32BuildAnalyzer');
    const customMap = cfg.get<string>('mapFilePath');
    const customElf = cfg.get<string>('elfFilePath');

    if (this.debug) {
      console.log('[STM32] Resolving build paths...');
      console.log(`[STM32] Custom map: ${customMap}`);
      console.log(`[STM32] Custom elf: ${customElf}`);
    }

    if (customMap && customElf && await this.exists(customMap) && await this.exists(customElf)) {
      if (this.debug) {console.log('[STM32] Using custom paths from settings.');}
      return {
        map: customMap,
        elf: customElf,
        toolchainPath: await this.getToolchainPath(),
      };
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('No workspace folder open');
    }

    const root = workspaceFolders[0].uri.fsPath;

    if (this.debug) {console.log(`[STM32] Scanning workspace folder: ${root}`);}

    const folders = await this.findBuildFolders(root);
    if (folders.length === 0) {
      throw new Error('No build folders containing both .map and .elf found');
    }

    const items: { label: string, detail: string, elf: string, map: string }[] = [];

    for (const folder of folders) {
      const files = fs.readdirSync(folder);
      const elfs = files.filter(f => f.endsWith('.elf'));
      const maps = files.filter(f => f.endsWith('.map'));

      for (const elf of elfs) {
        const basename = path.basename(elf, '.elf');
        const map = maps.find(m => m === basename + '.map');

        if (map) {
          const elfPath = path.join(folder, elf);
          const mapPath = path.join(folder, map);
          items.push({
            label: `$(file-binary) ${basename}`,
            detail: vscode.workspace.asRelativePath(folder),
            elf: elfPath,
            map: mapPath
          });
        }
      }
    }

    if (items.length === 0) {
       throw new Error('No matching .elf and .map files found');
    }

    let selectedItem = items[0];
    
    if (items.length > 1) {
      const pick = await vscode.window.showQuickPick(items, { 
        placeHolder: 'Select build artifact (.elf & .map)' 
      });
      if (!pick) {
        throw new Error('Selection cancelled');
      }
      selectedItem = pick;
    }

    if (this.debug) {
        console.log(`[STM32] Selected ELF: ${selectedItem.elf}`);
        console.log(`[STM32] Selected MAP: ${selectedItem.map}`);
    }

    return {
      map: selectedItem.map,
      elf: selectedItem.elf,
      toolchainPath: await this.getToolchainPath(),
    };
  }

  private async getToolchainPath(): Promise<string | undefined> {
    const cfg = vscode.workspace.getConfiguration('stm32BuildAnalyzerEnhanced');
    const toolchain = cfg.get<string>('toolchainPath');

    if (!toolchain) {return undefined;}

    if (await this.exists(toolchain)) {
      if (this.debug) {console.log(`[STM32] Using toolchain: ${toolchain}`);}
      vscode.window.showInformationMessage(
        `STM32 Build Analyzer: Using toolchain from ${toolchain}`
      );
      return toolchain;
    } else {
      vscode.window.showWarningMessage(
        `STM32 Build Analyzer: toolchainPath not found: ${toolchain}`
      );
      if (this.debug) {console.warn(`[STM32] Toolchain path not found: ${toolchain}`);}
    }

    return undefined;
  }

  private async exists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
      return true;
    } catch {
      if (this.debug) {console.warn(`[STM32] File not accessible: ${filePath}`);}
      return false;
    }
  }

  private async findBuildFolders(root: string): Promise<string[]> {
    const found = new Set<string>();
    const common = ['build', 'Build', 'Release', 'Debug', 'out', 'output']
      .map(p => path.join(root, p));

    const visited = new Set<string>();
    // Heuristic: assume Windows and macOS are case-insensitive by default
    const isCaseInsensitive = process.platform === 'win32' || process.platform === 'darwin';

    const walk = (dir: string) => {
      const key = isCaseInsensitive ? dir.toLowerCase() : dir;
      if (visited.has(key)) { return; }
      visited.add(key);

      try {
        let hasMap = false, hasElf = false;
        for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, d.name);
          if (d.isDirectory()) {
            walk(full);
          } else if (d.name.endsWith('.map')) {
            hasMap = true;
          } else if (d.name.endsWith('.elf')) {
            hasElf = true;
          }
        }
        if (hasMap && hasElf) {
          if (this.debug) {console.log(`[STM32] Found build folder: ${dir}`);}
          found.add(dir);
        }
      } catch (err) {
        if (this.debug) {console.warn(`[STM32] Failed to access folder: ${dir}`);}
      }
    };

    for (const c of common) {
      if (fs.existsSync(c)) {
        walk(c);
      }
    }
    if (found.size === 0) {
      walk(root);
    }

    return Array.from(found);
  }

  private async findFile(folder: string, ext: string): Promise<string | undefined> {
    const files = fs.readdirSync(folder).filter(f => f.endsWith(ext));
    if (files.length === 0) {
      if (this.debug) {console.warn(`[STM32] No ${ext} files in ${folder}`);}
      return undefined;
    }

    files.sort((a, b) => {
      if (a.includes('Release')) {return -1;}
      if (b.includes('Release')) {return 1;}
      if (a.includes('Debug')) {return -1;}
      if (b.includes('Debug')) {return 1;}
      return 0;
    });

    const p = path.join(folder, files[0]);

    try {
      fs.accessSync(p, fs.constants.R_OK);

      if (ext === '.map' && fs.statSync(p).size === 0) {
        throw new Error('Map file is empty');
      }

      if (this.debug) {console.log(`[STM32] Selected ${ext} file: ${p}`);}
      return p;
    } catch (err) {
      if (this.debug) {console.warn(`[STM32] Could not use file: ${p}`);}
      return undefined;
    }
  }
}
