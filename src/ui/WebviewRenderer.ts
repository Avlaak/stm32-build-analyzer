import * as vscode from 'vscode';
import { Region } from '../models';

export class WebviewRenderer {
  private readonly debug: boolean;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly view: vscode.WebviewView
  ) {
    this.debug = vscode.workspace
      .getConfiguration('stm32BuildAnalyzerEnhanced')
      .get<boolean>('debug') ?? false;
  }

  public init(): void {
    this.view.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

    this.view.webview.html = this.getHtml();

    if (this.debug) {
      console.log('[STM32 Webview] Initialized webview with HTML and options.');
    }

    this.view.webview.onDidReceiveMessage(msg => {
      if (this.debug) {
        console.log(`[STM32 Webview] Received message:`, msg);
      }

      switch (msg.command) {
        case 'requestRefresh':
          vscode.commands.executeCommand('stm32BuildAnalyzerEnhanced.refresh');
          break;
        case 'refreshPaths':
          vscode.commands.executeCommand('stm32BuildAnalyzerEnhanced.refreshPaths');
          break;
        case 'openFile':
          this.openFile(msg.filePath, msg.lineNumber);
          break;
      }
    });
  }

  public showData(regions: Region[], buildFolder: string) {
    if (this.debug) {
      console.log(`[STM32 Webview] Sending ${regions.length} region(s) to webview.`);
    }

    this.view.webview.postMessage({
      command: 'showMapData',
      data: regions,
      currentBuildFolderRelativePath: buildFolder
    });
  }

  private async openFile(file: string, line: number) {
    try {
      if (this.debug) {
        console.log(`[STM32 Webview] Attempting to open file: ${file} @ ${line}`);
      }

      const uri = vscode.Uri.file(file);
      const doc = await vscode.workspace.openTextDocument(uri);
      const ed = await vscode.window.showTextDocument(doc);
      const pos = new vscode.Position(line - 1, 0);
      ed.selection = new vscode.Selection(pos, pos);
      ed.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    } catch (err) {
      vscode.window.showErrorMessage(`Cannot open ${file}`);
      if (this.debug) {
        console.error(`[STM32 Webview] Failed to open file: ${file}`, err);
      }
    }
  }

  private getHtml(): string {
    const web = this.view.webview;
    const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${web.cspSource} blob:; script-src 'unsafe-inline' ${web.cspSource}; style-src ${web.cspSource} 'unsafe-inline';">`;
    const icon1Uri = web.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'resources', '1.png'));
    const icon2Uri = web.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'resources', '2.png'));
    const icon3Uri = web.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'resources', '3.png'));

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            ${csp}
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Build Analyzer</title>
            <style>
                table.gray {
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    font-family: var(--vscode-font-family);
                    width: 100%;
                    text-align: left;
                    border-collapse: collapse;
                }
                table.gray td, table.gray th {
                    border: 1px solid var(--highlight-color);
                    padding: 3px 2px;
                }
                table.gray td:nth-child(5),
                table.gray td:nth-child(6) {
                    text-align: right;
                }
                table.gray tbody td {
                    font-size: 13px;
                }
                
                table.gray thead {
                    background: var(--highlight-color);
                    border-bottom: 2px solid var(--highlight-color);
                }
                table.gray thead th {
                    font-size: 15px;
                    font-weight: bold;
                    border-left: 2px solid var(--highlight-color);
                }
                table.gray thead th:first-child {
                    border-left: none;
                }
                #regionsHead td {
                    text-align: center;
                }
                #regionsBody td {
                    padding-left: 5px;
                    padding-right: 5px;
                }  
                #regionsBody td.right-align {
                    text-align: right;
                }
                .bar { 
                    background-color: var(--vscode-editorWidget-border); 
                    width: 100px; 
                    height: 100%;
                    display: inline-block;
                } 
                .toggle {
                    cursor: pointer;
                    display: inline-block;
                    width: 20px;
                    user-select: none;
                }
                #refreshButton,
                #refreshPathsButton {
                    padding: 5px 10px;
                    cursor: pointer;
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    border: none;
                    border-radius: 2px;
                    height: 26px;
                    box-sizing: border-box;
                    font-family: var(--vscode-font-family);
                    font-size: 13px;
                    white-space: nowrap;
                }

                #refreshButton:hover,
                #refreshPathsButton:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }

                .button-container {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 10px;
                    flex-wrap: nowrap;
                }

                .search-widget {
                    display: flex;
                    align-items: center;
                    background-color: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 2px;
                    height: 26px;
                    box-sizing: border-box;
                    padding: 0 2px;
                }

                .search-widget:focus-within {
                    outline: 1px solid var(--vscode-focusBorder);
                    border-color: var(--vscode-focusBorder);
                }

                #searchInput {
                    flex: 1;
                    padding: 3px 6px;
                    background-color: transparent;
                    color: var(--vscode-input-foreground);
                    border: none;
                    font-family: var(--vscode-font-family);
                    font-size: 13px;
                    height: 22px;
                    box-sizing: border-box;
                    min-width: 100px;
                    outline: none;
                }

                #searchInput::placeholder {
                    color: var(--vscode-input-placeholderForeground);
                }

                .search-options {
                    display: flex;
                    align-items: center;
                    gap: 1px;
                    padding-right: 2px;
                }

                .search-option {
                    width: 22px;
                    height: 22px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    border-radius: 3px;
                    background-color: transparent;
                    border: none;
                    color: var(--vscode-input-foreground);
                    font-family: var(--vscode-font-family);
                    font-size: 13px;
                    font-weight: bold;
                    opacity: 0.7;
                }

                .search-option:hover {
                    background-color: var(--vscode-toolbar-hoverBackground);
                    opacity: 1;
                }

                .search-option.active {
                    background-color: var(--vscode-inputOption-activeBackground);
                    color: var(--vscode-inputOption-activeForeground);
                    border: 1px solid var(--vscode-inputOption-activeBorder);
                    opacity: 1;
                }

                .search-option[title="Match Case"] {
                    font-size: 13px;
                    font-weight: normal;
                }

                .search-option[title="Match Whole Word"] {
                    font-size: 13px;
                    font-weight: normal;
                    text-decoration: underline;
                }

                .search-option[title="Use Regular Expression"] {
                    font-size: 13px;
                    font-weight: normal;
                }

                .search-highlight {
                    background-color: var(--vscode-editor-findMatchHighlightBackground);
                }

                .search-match-count {
                    font-family: var(--vscode-font-family);
                    font-size: 13px;
                    color: var(--vscode-descriptionForeground);
                    white-space: nowrap;
                }

                .sortable-header {
                    cursor: pointer;
                    user-select: none;
                    white-space: nowrap;
                }

                .sortable-header:hover {
                    background-color: var(--vscode-list-hoverBackground);
                }

                .sort-indicator {
                    display: inline-block;
                    margin-left: 4px;
                    opacity: 0.3;
                    font-size: 13px;
                }

                .sort-indicator.active {
                    opacity: 1;
                    color: var(--vscode-textLink-foreground);
                }

                .table-container {
                    display: flex;
                    flex-direction: column;
                    height: 99vh;
                    overflow: hidden;
                }

                .button-container-sticky {
                    position: sticky;
                    top: 0;
                    background-color: var(--vscode-sideBar-background);
                    border-bottom: 1px solid var(--vscode-panel-border);
                    z-index: 11;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 4px 8px;
                    gap: 8px;
                    margin-bottom: 0;
                    flex-wrap: nowrap;
                }

                .left-controls {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    flex: 1;
                    overflow: hidden;
                }

                .build-folder-info {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    font-family: var(--vscode-font-family);
                    font-size: 13px;
                }

                #buildFolderPath {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                
                #buildFolderPath:empty::before {
                    content: "Not selected";
                    color: var(--vscode-descriptionForeground);
                    font-style: italic;
                }

                .right-controls {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                #regionsTable {
                    width: 100%;
                    border-collapse: collapse;
                    flex: 1;
                }

                #regionsTable thead th {
                    position: sticky;
                    top: 34px;
                    background: var(--vscode-list-header-background, var(--vscode-editor-background, #f8f8f8));
                    z-index: 12;
                    border-bottom: 2px solid #000;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }

                #regionsTable tbody {
                    display: block;
                    height: calc(99vh - 34px);
                    overflow-y: auto;
                }

                #regionsTable thead, 
                #regionsTable tbody tr {
                    display: table;
                    width: 100%;
                    table-layout: fixed;
                }

                #regionsTable tbody tr {
                    width: 100%;
                }


            </style>
        </head>
        <body>
           <div class="table-container">
            <div class="button-container-sticky">
                <div class="left-controls">
                    <div class="build-folder-info">
                        <label><strong>Current Build Folder:</strong></label>
                        <span id="buildFolderPath"></span>
                    </div>
                    <button id="refreshPathsButton" class="button">Change</button>
                    <button id="refreshButton" class="button">Refresh Analyze</button>
                </div>
                
                <div class="right-controls">
                    <div class="search-widget">
                        <input type="text" id="searchInput" placeholder="Search symbols..." />
                        <div class="search-options">
                            <button class="search-option" id="caseSensitive" title="Match Case">Aa</button>
                            <button class="search-option" id="wholeWord" title="Match Whole Word">ab</button>
                            <button class="search-option" id="useRegex" title="Use Regular Expression">.*</button>
                        </div>
                    </div>
                    <span id="searchMatchCount" class="search-match-count"></span>
                </div>
            </div>

            <table id="regionsTable" class="scroll-container">
                <thead id="regionsHead">
                    <tr>
                        <td></td>
                        <td class="sortable-header" data-sort="name">Name <span class="sort-indicator" id="sort-name">↕</span></td>
                        <td class="sortable-header" data-sort="address">Address <span class="sort-indicator" id="sort-address">↕</span></td>
                        <td class="sortable-header" data-sort="size">Size <span class="sort-indicator" id="sort-size">↕</span></td>
                        <td>Used</td>
                        <td>Free</td>
                    </tr>
                </thead>
                <tbody id="regionsBody">
                </tbody>
            </table>
        </div>
            <script>
                const vscode = acquireVsCodeApi();
                
                function formatBytes(bytes, decimals = 2) {
                    if (bytes <= 0) return '0 B';
                    const k = 1024;
                    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                    const value = parseFloat((bytes / Math.pow(k, i)).toFixed(decimals));
                    return \`\${value} \${sizes[i]}\`;
                }

                function resetTableRegions() {
                    document.getElementById('regionsBody').innerHTML = '';
                }
                    
                function fillTableRegions(regions) {
                    const tableBody = document.getElementById('regionsBody');
                    tableBody.innerHTML = '';

                    let id = 0;

                    regions.forEach(region => {
                        id++;
                        const regionId = id;
                        const percent = region.used / region.size * 100;

                        const tableTr = document.createElement('tr');
                        tableTr.className = 'toggleTr level-1';
                        tableTr.setAttribute('data-level', '1');
                        tableTr.setAttribute('data-id', regionId);
                        
                        const tableTd1 = document.createElement('td');
                        const plus = document.createElement('span');
                        plus.className = 'toggle';
                        plus.textContent = '+';
                        tableTd1.appendChild(plus);
                        
                        const bar = document.createElement('div');
                        bar.className = 'bar';
                        const progress = document.createElement('div');
                        progress.setAttribute('style', \`
                            width: \${percent}%; 
                            background-color: \${percent > 95 ? 'var(--vscode-minimap-errorHighlight)' : 
                                             percent > 75 ? 'var(--vscode-minimap-warningHighlight)' : 
                                             'var(--vscode-minimap-infoHighlight)'}; 
                            height: 100%;
                            color: \${percent > 50 ? 'white' : 'black'};
                            text-align: center;
                            font-size: 12px;
                            line-height: 1.5;
                        \`);
                        progress.textContent = \`\${percent.toFixed(2)}%\`;
                        bar.appendChild(progress);
                        tableTd1.appendChild(bar);

                        const tableTd2 = document.createElement('td');
                        const img = document.createElement('img');
                        img.src = '${icon1Uri}';
                        img.alt = 'Icon';
                        img.style.width = '16px';
                        img.style.height = '16px';
                        img.style.verticalAlign = 'middle';
                        img.style.marginRight = '5px';
                        tableTd2.appendChild(img); 
                        tableTd2.appendChild(document.createTextNode(\` \${region.name} \`));

                        const tableTd3 = document.createElement('td');
                        tableTd3.appendChild(document.createTextNode(\`0x\${region.startAddress.toString(16).padStart(8,'0')}\`));

                        const tableTd4 = document.createElement('td');
                        tableTd4.className = 'right-align';
                        tableTd4.appendChild(document.createTextNode(formatBytes(region.size)));

                        const tableTd5 = document.createElement('td');
                        tableTd5.className = 'right-align';
                        tableTd5.appendChild(document.createTextNode(formatBytes(region.used)));

                        const tableTd6 = document.createElement('td');
                        tableTd6.className = 'right-align';
                        tableTd6.appendChild(document.createTextNode(formatBytes(region.size-region.used)));
                        
                        tableTr.appendChild(tableTd1);
                        tableTr.appendChild(tableTd2);
                        tableTr.appendChild(tableTd3);
                        tableTr.appendChild(tableTd4);
                        tableTr.appendChild(tableTd5);
                        tableTr.appendChild(tableTd6);
                        tableBody.appendChild(tableTr);

                        region.sections.forEach(section => {
                            id++;
                            const sectionId = id;
                            const sectionTr = document.createElement('tr');
                            sectionTr.className = 'toggleTr level-2';
                            sectionTr.setAttribute('data-level', '2');
                            sectionTr.setAttribute('data-id', sectionId);
                            sectionTr.setAttribute('data-parent', regionId);
                            sectionTr.style.display = 'none';

                            const sectionTd1 = document.createElement('td');
                            const plus = document.createElement('span');
                            plus.className = 'toggle';
                            plus.textContent = '+';
                            sectionTd1.appendChild(plus);

                            const sectionTd2 = document.createElement('td');
                            const img = document.createElement('img');
                            img.src = '${icon2Uri}';
                            img.alt = 'Icon';
                            img.style.width = '16px';
                            img.style.height = '16px';
                            img.style.verticalAlign = 'middle';
                            img.style.marginRight = '5px';
                            sectionTd2.appendChild(img); 
                            sectionTd2.appendChild(document.createTextNode(\` \${section.name} \`));
                            sectionTd2.style.paddingLeft = '15px';

                            const sectionTd3 = document.createElement('td');
                            sectionTd3.appendChild(document.createTextNode(\`0x\${section.startAddress.toString(16).padStart(8,'0')}\`));

                            const sectionTd4 = document.createElement('td');
                            sectionTd4.className = 'right-align';
                            sectionTd4.appendChild(document.createTextNode(formatBytes(section.size)));

                            const sectionTd5 = document.createElement('td');
                            sectionTd5.className = 'right-align';
                            const sectionTd6 = document.createElement('td');
                            sectionTd6.className = 'right-align';
                            
                            sectionTr.appendChild(sectionTd1);
                            sectionTr.appendChild(sectionTd2);
                            sectionTr.appendChild(sectionTd3);
                            sectionTr.appendChild(sectionTd4);
                            sectionTr.appendChild(sectionTd5);
                            sectionTr.appendChild(sectionTd6);
                            tableBody.appendChild(sectionTr);

                            let symbolIndex = 0;
                            section.symbols.forEach(symbol => {
                                id++;
                                symbolIndex++;
                                const pointTr = document.createElement('tr');
                                pointTr.className = 'toggleTr level-3';
                                pointTr.setAttribute('data-level', '3');
                                pointTr.setAttribute('data-id', id);
                                pointTr.setAttribute('data-parent', sectionId);
                                pointTr.setAttribute('data-original-index', symbolIndex);
                                pointTr.style.display = 'none';
                                
                                const pointTd1 = document.createElement('td');
                                const pointTd2 = document.createElement('td');
                                pointTd2.setAttribute('title', \`\${symbol.path}:\${symbol.row}\`);

                                const img = document.createElement('img');
                                img.src = '${icon3Uri}';
                                img.alt = 'Icon';
                                img.style.width = '16px';
                                img.style.height = '16px';
                                img.style.verticalAlign = 'middle';
                                img.style.marginRight = '5px';
                                pointTd2.appendChild(img); 

                                if (symbol.path === '') {
                                    pointTd2.appendChild(document.createTextNode(\` \${symbol.name} \`));
                                } else {
                                    const link = document.createElement('a');
                                    link.className = 'source-link';
                                    link.href = '#';
                                    link.dataset.file = symbol.path;
                                    link.dataset.line = symbol.row.toString();
                                    link.appendChild(document.createTextNode(\` \${symbol.name} \`));
                                    pointTd2.appendChild(link);
                                }
                                pointTd2.style.paddingLeft = '25px';

                                const pointTd3 = document.createElement('td');
                                pointTd3.appendChild(document.createTextNode(\`0x\${symbol.startAddress.toString(16).padStart(8,'0')}\`));

                                const pointTd4 = document.createElement('td');
                                pointTd4.className = 'right-align';
                                pointTd4.appendChild(document.createTextNode(\`\${symbol.size} B\`));
                                
                                const pointTd5 = document.createElement('td');
                                pointTd5.className = 'right-align';
                                const pointTd6 = document.createElement('td');
                                pointTd6.className = 'right-align';

                                pointTr.appendChild(pointTd1);
                                pointTr.appendChild(pointTd2);
                                pointTr.appendChild(pointTd3);
                                pointTr.appendChild(pointTd4);
                                pointTr.appendChild(pointTd5);
                                pointTr.appendChild(pointTd6);
                                tableBody.appendChild(pointTr);
                            });
                        });
                    });
                }

                document.addEventListener('DOMContentLoaded', () => {
                    vscode.postMessage({ command: 'requestRefresh' });
                    
                    document.getElementById('refreshButton').addEventListener('click', () => {
                        vscode.postMessage({ command: 'requestRefresh' });
                    });
                    document.getElementById('refreshPathsButton').addEventListener('click', () => {
                        vscode.postMessage({ command: 'refreshPaths' });
                    });

                    // Search functionality
                    const searchInput = document.getElementById('searchInput');
                    const caseSensitiveBtn = document.getElementById('caseSensitive');
                    const wholeWordBtn = document.getElementById('wholeWord');
                    const useRegexBtn = document.getElementById('useRegex');

                    let searchTimeout;

                    searchInput.addEventListener('input', () => {
                        clearTimeout(searchTimeout);
                        searchTimeout = setTimeout(() => {
                            performSearch(searchInput.value.trim());
                        }, 200);
                    });

                    searchInput.addEventListener('keydown', (e) => {
                        if (e.key === 'Escape') {
                            searchInput.value = '';
                            performSearch('');
                        }
                    });

                    // Toggle search options
                    [caseSensitiveBtn, wholeWordBtn, useRegexBtn].forEach(btn => {
                        btn.addEventListener('click', () => {
                            btn.classList.toggle('active');
                            performSearch(searchInput.value.trim());
                        });
                    });

                    // Sort functionality - clickable headers
                    let currentSortField = null;
                    let isAscending = true;

                    document.querySelectorAll('.sortable-header').forEach(header => {
                        header.addEventListener('click', () => {
                            const field = header.getAttribute('data-sort');
                            
                            if (currentSortField === field) {
                                // Toggle direction or reset
                                if (isAscending) {
                                    isAscending = false;
                                } else {
                                    // Reset sorting - sort by original index
                                    currentSortField = null;
                                    isAscending = true;
                                    updateSortIndicators();
                                    applySorting('original');
                                    return;
                                }
                            } else {
                                currentSortField = field;
                                isAscending = true;
                            }
                            
                            updateSortIndicators();
                            applySorting(field);
                        });
                    });

                    function updateSortIndicators() {
                        document.querySelectorAll('.sort-indicator').forEach(indicator => {
                            indicator.textContent = '↕';
                            indicator.classList.remove('active');
                        });
                        
                        if (currentSortField) {
                            const indicator = document.getElementById('sort-' + currentSortField);
                            if (indicator) {
                                indicator.textContent = isAscending ? '↑' : '↓';
                                indicator.classList.add('active');
                            }
                        }
                    }

                    function applySorting(field) {

                        const tableBody = document.getElementById('regionsBody');
                        const allRows = Array.from(tableBody.querySelectorAll('.toggleTr'));
                        
                        // Group rows by hierarchy
                        const regions = [];
                        let currentRegion = null;
                        let currentSection = null;

                        allRows.forEach(row => {
                            const level = parseInt(row.getAttribute('data-level'), 10);
                            if (level === 1) {
                                currentRegion = { row: row, sections: [] };
                                regions.push(currentRegion);
                                currentSection = null;
                            } else if (level === 2 && currentRegion) {
                                currentSection = { row: row, symbols: [] };
                                currentRegion.sections.push(currentSection);
                            } else if (level === 3 && currentSection) {
                                currentSection.symbols.push(row);
                            }
                        });

                        // Sort symbols within each section (only level 3 - symbols)
                        regions.forEach(region => {
                            region.sections.forEach(section => {
                                section.symbols.sort((a, b) => {
                                    let valA, valB;
                                    if (field === 'original') {
                                        // Sort by original index to restore default order
                                        valA = parseInt(a.getAttribute('data-original-index'), 10) || 0;
                                        valB = parseInt(b.getAttribute('data-original-index'), 10) || 0;
                                        return valA - valB;
                                    } else if (field === 'name') {
                                        valA = a.querySelector('td:nth-child(2)').textContent.trim().toLowerCase();
                                        valB = b.querySelector('td:nth-child(2)').textContent.trim().toLowerCase();
                                        return isAscending ? valA.localeCompare(valB) : valB.localeCompare(valA);
                                    } else if (field === 'address') {
                                        // Parse hex address from the 3rd column
                                        const addrTextA = a.querySelector('td:nth-child(3)').textContent.trim();
                                        const addrTextB = b.querySelector('td:nth-child(3)').textContent.trim();
                                        valA = parseInt(addrTextA, 16) || 0;
                                        valB = parseInt(addrTextB, 16) || 0;
                                        return isAscending ? valA - valB : valB - valA;
                                    } else if (field === 'size') {
                                        // Extract size in bytes from the 4th column
                                        const sizeTextA = a.querySelector('td:nth-child(4)').textContent.trim();
                                        const sizeTextB = b.querySelector('td:nth-child(4)').textContent.trim();
                                        valA = parseSizeToBytes(sizeTextA);
                                        valB = parseSizeToBytes(sizeTextB);
                                        return isAscending ? valA - valB : valB - valA;
                                    }
                                    return 0;
                                });
                            });
                        });

                        // Rebuild table with updated IDs
                        tableBody.innerHTML = '';
                        let newId = 0;
                        regions.forEach(region => {
                            newId++;
                            const regionId = newId;
                            region.row.setAttribute('data-id', regionId);
                            tableBody.appendChild(region.row);
                            
                            region.sections.forEach(section => {
                                newId++;
                                const sectionId = newId;
                                section.row.setAttribute('data-id', sectionId);
                                section.row.setAttribute('data-parent', regionId);
                                tableBody.appendChild(section.row);
                                
                                section.symbols.forEach(symbol => {
                                    newId++;
                                    symbol.setAttribute('data-id', newId);
                                    symbol.setAttribute('data-parent', sectionId);
                                    tableBody.appendChild(symbol);
                                });
                            });
                        });
                    }

                    function parseSizeToBytes(sizeText) {
                        // Parse formats like "128 KB", "1.5 MB", "256 B", "100 B"
                        const match = sizeText.match(/([\\d.]+)\\s*(B|KB|MB|GB|TB)?/i);
                        if (!match) return 0;
                        const value = parseFloat(match[1]);
                        const unit = (match[2] || 'B').toUpperCase();
                        const multipliers = { 'B': 1, 'KB': 1024, 'MB': 1024*1024, 'GB': 1024*1024*1024, 'TB': 1024*1024*1024*1024 };
                        return value * (multipliers[unit] || 1);
                    }
                });

                function performSearch(query) {
                    const searchMatchCount = document.getElementById('searchMatchCount');
                    const allRows = document.querySelectorAll('.toggleTr');
                    const caseSensitive = document.getElementById('caseSensitive').classList.contains('active');
                    const wholeWord = document.getElementById('wholeWord').classList.contains('active');
                    const useRegex = document.getElementById('useRegex').classList.contains('active');
                    
                    // Remove previous highlights
                    document.querySelectorAll('.search-highlight').forEach(el => {
                        el.classList.remove('search-highlight');
                    });

                    let matchCount = 0;

                    if (!query) {
                        // Reset to default view - hide all child rows
                        allRows.forEach(row => {
                            const level = parseInt(row.getAttribute('data-level'), 10);
                            if (level === 1) {
                                row.style.display = '';
                                const toggle = row.querySelector('.toggle');
                                if (toggle) toggle.textContent = '+';
                            } else {
                                const toggle = row.querySelector('.toggle');
                                if (toggle) toggle.textContent = '+';
                                row.style.display = 'none';
                            }
                        });
                        searchMatchCount.textContent = '';
                        return;
                    }

                    // Build matcher function based on options
                    let matcher;
                    try {
                        if (useRegex) {
                            const flags = caseSensitive ? '' : 'i';
                            const pattern = wholeWord ? String.fromCharCode(92) + 'b' + query + String.fromCharCode(92) + 'b' : query;
                            const regex = new RegExp(pattern, flags);
                            matcher = (text) => regex.test(text);
                        } else {
                            const searchQuery = caseSensitive ? query : query.toLowerCase();
                            if (wholeWord) {
                                // Simple word boundary check without regex for non-regex mode
                                matcher = (text) => {
                                    const searchIn = caseSensitive ? text : text.toLowerCase();
                                    const idx = searchIn.indexOf(searchQuery);
                                    if (idx === -1) return false;
                                    const before = idx === 0 || !/[a-zA-Z0-9_]/.test(searchIn[idx - 1]);
                                    const after = idx + searchQuery.length >= searchIn.length || !/[a-zA-Z0-9_]/.test(searchIn[idx + searchQuery.length]);
                                    return before && after;
                                };
                            } else {
                                matcher = (text) => {
                                    const searchIn = caseSensitive ? text : text.toLowerCase();
                                    return searchIn.includes(searchQuery);
                                };
                            }
                        }
                    } catch (e) {
                        // Invalid regex
                        searchMatchCount.textContent = 'Invalid regex';
                        return;
                    }

                    const parentsToShow = new Set();

                    // First pass: find matching symbols (level 3)
                    allRows.forEach(row => {
                        const level = parseInt(row.getAttribute('data-level'), 10);
                        if (level === 3) {
                            const nameCell = row.querySelector('td:nth-child(2)');
                            const symbolName = nameCell ? nameCell.textContent.trim() : '';
                            
                            if (matcher(symbolName)) {
                                matchCount++;
                                row.style.display = '';
                                nameCell.classList.add('search-highlight');
                                
                                // Mark parent section and region to show
                                const sectionId = row.getAttribute('data-parent');
                                parentsToShow.add(sectionId);
                                
                                const sectionRow = document.querySelector(\`tr[data-id="\${sectionId}"]\`);
                                if (sectionRow) {
                                    const regionId = sectionRow.getAttribute('data-parent');
                                    parentsToShow.add(regionId);
                                }
                            } else {
                                row.style.display = 'none';
                            }
                        }
                    });

                    // Second pass: show/hide sections and regions based on matches
                    allRows.forEach(row => {
                        const level = parseInt(row.getAttribute('data-level'), 10);
                        const id = row.getAttribute('data-id');
                        const toggle = row.querySelector('.toggle');

                        if (level === 1) {
                            if (parentsToShow.has(id)) {
                                row.style.display = '';
                                if (toggle) toggle.textContent = '−';
                            } else {
                                row.style.display = 'none';
                                if (toggle) toggle.textContent = '+';
                            }
                        } else if (level === 2) {
                            if (parentsToShow.has(id)) {
                                row.style.display = '';
                                if (toggle) toggle.textContent = '−';
                            } else {
                                row.style.display = 'none';
                                if (toggle) toggle.textContent = '+';
                            }
                        }
                    });

                    searchMatchCount.textContent = matchCount > 0 
                        ? 'Found: ' + matchCount + ' symbols'
                        : 'No matches';
                }

                document.getElementById('regionsTable').addEventListener('click', (e) => {
                    const toggleSpan = e.target.closest('.toggle');

                    const searchInput = document.getElementById('searchInput');
                    if (searchInput && searchInput.value) {
                        return;
                    }
                    if (toggleSpan) {
                        const tr = toggleSpan.closest('tr');
                        const level = parseInt(tr.getAttribute('data-level'), 10);
                        const parentId = tr.getAttribute('data-id');

                        const childRows = document.querySelectorAll(\`tr[data-parent="\${parentId}"]\`);
                        childRows.forEach(child => {
                            child.style.display = child.style.display === 'none' ? '' : 'none';
                            if (child.style.display === 'none')
                            {
                                const toggle = child.querySelector('.toggle');
                                if (toggle) toggle.textContent = '+';
                            }
                            const childId = child.getAttribute('data-id');
                            const childLevel = parseInt(child.getAttribute('data-level'), 10);
                            if (child.style.display === 'none' && childLevel === 2) {
                                const grandChildRows = document.querySelectorAll(\`tr[data-parent="\${childId}"]\`);
                                grandChildRows.forEach(grandChild => {
                                    if (grandChild.style.display !== 'none') {
                                        grandChild.style.display = 'none';
                                    }
                                });
                            }
                        });

                        toggleSpan.textContent = toggleSpan.textContent === '+' ? '−' : '+';
                    }

                    const sourceLink = e.target.closest('.source-link');
                    if (sourceLink) {
                        e.preventDefault();
                        vscode.postMessage({
                            command: 'openFile',
                            filePath: sourceLink.dataset.file,
                            lineNumber: parseInt(sourceLink.dataset.line, 10)
                        });
                    }
                });

                window.addEventListener('message', event => {
                    const message = event.data;

                    switch (message.command) {
                        case 'showMapData':
                            resetTableRegions();
                            fillTableRegions(message.data);
                            if (message.currentBuildFolderRelativePath) {
                                const folderDiv = document.getElementById('buildFolderPath');
                                folderDiv.textContent = message.currentBuildFolderRelativePath;
                            }
                            // Reset search when data is refreshed
                            const searchInput = document.getElementById('searchInput');
                            if (searchInput && searchInput.value) {
                                performSearch(searchInput.value.trim());
                            }
                            break;
                    }
                });



            </script>
        </body>
        </html>`;
  }
}
