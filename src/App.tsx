import { useEffect, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { Activity, AlertTriangle, ArrowDown, ArrowRight, Bot, Box, Check, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, Clock3, Code2, Command, FileCode2, FileText, Folder, GitBranch, GitCommitHorizontal, GitPullRequest, LayoutDashboard, LockKeyhole, Menu, MessageSquare, MoreHorizontal, PanelLeftClose, Play, Plus, Search, Send, Settings2, Shield, Sparkles, Terminal, TestTube2, Upload, Workflow, X, Zap } from 'lucide-react'

const nav = [
  { icon: LayoutDashboard, label: 'Repository scan' }, { icon: Settings2, label: 'Interface Studio' },
]
type Finding = { severity: 'error' | 'warning'; rule: string; path: string; line: number; message: string }
type ScannedFile = { path: string; size: number; language: string; content: string }
type ScanResult = { filename: string; source_files: ScannedFile[]; source_file_count: number; findings: Finding[]; finding_count: number; status: string; message: string }
type ModelAnalysis = { summary:string; root_cause:string; confidence:string; evidence:{path:string;line:number;snippet:string;explanation:string}[]; patches:{path:string;start_line:number;before:string;after:string;reason:string}[]; tests_to_run:string[]; limitations:string }
const SOURCE_EXTENSIONS = new Set(['.py','.js','.jsx','.ts','.tsx','.java','.c','.h','.cpp','.hpp','.json','.toml','.yml','.yaml','.md','.txt'])
async function scanZip(file: File): Promise<ScanResult> {
  if (!file.name.toLowerCase().endsWith('.zip')) throw new Error('Choose a .zip archive.')
  if (file.size > 25 * 1024 * 1024) throw new Error('ZIP files must be 25 MiB or smaller.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  if(bytes.length<22)throw new Error('This ZIP is empty or too small to be valid.')
  const view = new DataView(bytes.buffer)
  const u16=(o:number)=>view.getUint16(o,true), u32=(o:number)=>view.getUint32(o,true)
  let end=-1; for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(u32(i)===0x06054b50){end=i;break}
  if(end<0)throw new Error('This does not look like a valid ZIP archive.')
  const count=u16(end+10), directorySize=u32(end+12), directoryOffset=u32(end+16)
  if(count>5000||directoryOffset+directorySize>bytes.length)throw new Error('This ZIP exceeds the supported archive limits.')
  const decoder=new TextDecoder('utf-8',{fatal:false}), sourceFiles:ScannedFile[]=[]
  let cursor=directoryOffset, total=0
  for(let n=0;n<count;n++){
    if(cursor+46>bytes.length||u32(cursor)!==0x02014b50)throw new Error('The ZIP directory is damaged or unsupported.')
    const flags=u16(cursor+8), method=u16(cursor+10), compressed=u32(cursor+20), size=u32(cursor+24), nameLen=u16(cursor+28), extraLen=u16(cursor+30), commentLen=u16(cursor+32), local=u32(cursor+42)
    const name=decoder.decode(bytes.subarray(cursor+46,cursor+46+nameLen)); cursor+=46+nameLen+extraLen+commentLen
    const normalized=name.replace(/\\/g,'/'), parts=normalized.split('/'), ext=(normalized.match(/\.[^./]+$/)?.[0]||'').toLowerCase()
    if(!SOURCE_EXTENSIONS.has(ext)||name.endsWith('/')||normalized.startsWith('/')||parts.includes('..')||(flags&1))continue
    total+=size;if(total>100*1024*1024)throw new Error('Source contents exceed the 100 MiB limit.')
    if(size>1_000_000)continue
    if(local+30>bytes.length||u32(local)!==0x04034b50)continue
    const dataStart=local+30+u16(local+26)+u16(local+28), compressedBytes=bytes.subarray(dataStart,dataStart+compressed)
    let contentBytes:Uint8Array
    if(method===0)contentBytes=compressedBytes
    else if(method===8){try{const stream=new Blob([compressedBytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));contentBytes=new Uint8Array(await new Response(stream).arrayBuffer())}catch{throw new Error('This browser cannot decompress this ZIP. Try a standard Deflate ZIP archive.')}}
    else continue
    if(contentBytes.length!==size)continue
    const content=decoder.decode(contentBytes)
    sourceFiles.push({path:name,size,language:ext.slice(1),content})
  }
  return analyzeSources(file.name,sourceFiles)
}
function analyzeSources(filename:string, sourceFiles:ScannedFile[]):ScanResult {
  const findings:Finding[]=[], secretPattern=/(?:api[_-]?key|secret|password|token)\s*[:=]\s*(['"])[A-Za-z0-9_\-/.+=]{12,}\1/i
  for(const file of sourceFiles)for(const [i,line] of file.content.split(/\r?\n/).entries()){
    if(file.path.toLowerCase().endsWith('.py')&&/\b(?:eval|exec)\s*\(/.test(line))findings.push({severity:'warning',rule:'python.dynamic-execution',path:file.path,line:i+1,message:'Dynamic code execution via eval/exec; review whether the input is trusted'})
    if(file.path.toLowerCase().endsWith('.py')&&/^\s*except\s*:/.test(line))findings.push({severity:'warning',rule:'python.bare-except',path:file.path,line:i+1,message:'Bare except catches system exceptions as well as application errors'})
    if(secretPattern.test(line))findings.push({severity:'warning',rule:'security.possible-hardcoded-secret',path:file.path,line:i+1,message:'Possible hard-coded credential; verify whether this value is sensitive'})
  }
  return {filename,source_files:sourceFiles.map(f=>({...f,size:new Blob([f.content]).size})),source_file_count:sourceFiles.length,findings,finding_count:findings.length,status:'static_pattern_scan_complete',message:'Files were scanned for common code patterns. No code was executed.'}
}

function matchProblem(statement:string, files:ScannedFile[]) {
  const ignored=new Set(['about','after','again','also','and','app','are','because','before','but','cannot','could','does','doesnt','during','error','fails','failure','from','have','help','how','into','issue','just','make','need','not','only','problem','same','should','that','the','then','this','when','where','with','would','your'])
  const terms=[...new Set((statement.toLowerCase().match(/[a-z0-9_]{3,}/g)||[]).filter(word=>!ignored.has(word)))]
  const matches=files.map(file=>{
    const code=file.content.toLowerCase(), path=file.path.toLowerCase()
    const scored=terms.map(term=>({term,score:(code.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'))||[]).length+(path.includes(term)?3:0)})).filter(x=>x.score>0)
    return {file,terms:scored.sort((a,b)=>b.score-a.score),score:scored.reduce((sum,item)=>sum+item.score,0),isCode:!['md','txt'].includes(file.language)}
  }).filter(item=>item.score>0).sort((a,b)=>Number(b.isCode)-Number(a.isCode)||b.score-a.score).slice(0,5)
  return {terms,matches}
}

function App() {
  const [active, setActive] = useState('Repository scan')
  const [sidebar, setSidebar] = useState(true)
  const [theme, setTheme] = useState(()=>localStorage.getItem('devpilot-theme')==='light')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [fontSize, setFontSize] = useState(()=>Number(localStorage.getItem('devpilot-editor-font-size')||12))
  const [repository, setRepository] = useState<ScanResult | null>(null)
  const [repositoryRevision,setRepositoryRevision]=useState(0)
  const [uploadStatus, setUploadStatus] = useState('')
  const [aiStatus,setAiStatus]=useState<'checking'|'ready'|'offline'|'unconfigured'>('checking')
  useEffect(()=>{localStorage.setItem('devpilot-theme',theme?'light':'dark')},[theme])
  useEffect(()=>{fetch('/api/health').then(response=>response.ok?response.json():Promise.reject()).then(data=>setAiStatus(data.analysis_available?'ready':'unconfigured')).catch(()=>setAiStatus('offline'))},[])
  useEffect(()=>{
    try { const pref=JSON.parse(localStorage.getItem('devpilot-interface')||'{}'); const color=studioColors.find(item=>item.id===pref.color)?.value||studioColors[0].value; document.documentElement.style.setProperty('--studio-accent',color); document.body.dataset.density=pref.density==='compact'?'compact':'comfortable' } catch { /* Use default workspace appearance. */ }
  },[])
  if (active === 'Interface Studio') return <InterfaceStudio onExit={() => setActive('Repository scan')} />
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setUploadStatus('Scanning ZIP locally…'); setRepository(null)
    try {
      const data = await scanZip(f)
      setRepository(data); setRepositoryRevision(value=>value+1); setUploadStatus('')
    } catch (err) {
      setUploadStatus((err as Error).message || 'Could not read this ZIP file.')
    }
  }
  const loadSample = async () => {
    setUploadStatus('Opening the included sample repository…')
    try { const response=await fetch('/sample-repository.zip'); if(!response.ok)throw new Error('Sample archive is unavailable.'); const file=new File([await response.blob()],'sample-repository.zip',{type:'application/zip'}); setRepository(await scanZip(file)); setRepositoryRevision(value=>value+1); setUploadStatus('') }
    catch(err){setUploadStatus((err as Error).message)}
  }
  return <div className={theme ? 'app light' : 'app'}>
    <aside className={sidebar ? 'sidebar' : 'sidebar collapsed'}>
      <div className="brand"><div className="brand-mark"><Code2 size={18}/></div><span>devpilot<span className="brand-ai">.ai</span></span><button className="icon-btn sidebar-toggle" onClick={()=>setSidebar(!sidebar)}><PanelLeftClose size={16}/></button></div>
      <button className="repo-select"><div className="repo-avatar">D</div><span className="repo-name"><b>{repository?.filename || 'DevPilot workspace'}</b><small>{repository ? `${repository.source_file_count} source files in this session` : 'No repository loaded'}</small></span></button>
      <div className="nav-label">WORKSPACE</div>
      <nav>{nav.map(n=><button key={n.label} className={'nav-item '+(active===n.label?'active':'')} onClick={()=>setActive(n.label)}><n.icon size={17}/><span>{n.label}</span></button>)}</nav>
      <div className="nav-label files-label">PROJECT FILES <button className="tiny-icon"><Plus size={13}/></button></div>
      <div className="tree-root"><ChevronDown size={13}/><Folder size={15} className="folder-icon"/><span>{repository?.filename || 'No repository loaded'}</span></div>
      {repository?.source_files.slice(0,80).map(item=><div key={item.path} className="tree-file"><FileCode2 size={14}/><span>{item.path}</span></div>)}
      <div className="sidebar-bottom"><div className="plan-card local-card"><div className="plan-head"><span><LockKeyhole size={13}/> Browser processing</span></div><small>ZIP contents stay in this tab. No code is executed.</small></div>
        <button className="nav-item" onClick={()=>setSettingsOpen(true)}><Settings2 size={17}/><span>Settings</span></button><div className="profile"><div className="avatar">LD</div><div><b>Local developer</b><small>Guest session</small></div></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs"><button className="icon-btn mobile-menu" onClick={()=>setSidebar(!sidebar)}><Menu size={17}/></button><span>{repository?.filename || 'DevPilot AI'}</span><ChevronRight size={14}/><b>{active}</b></div><div className="top-actions"><div className="branch"><LockKeyhole size={13}/> Local <ChevronDown size={13}/></div><div className="top-divider"/><button className="icon-btn" title="Search"><Search size={17}/></button><button className="icon-btn" title="Help"><CircleHelp size={17}/></button><div className="avatar small-avatar">LD</div></div></header>
      <div className="page-scroll"><div className="page-content">
        <div className="welcome-row"><div><div className="eyebrow"><span className="status-pulse"/> DEVPILOT AI <span className="eyebrow-sep">/</span> <span>LOCAL REPOSITORY REVIEW</span></div><h1>What’s going wrong?</h1><p className="subtitle">Upload your project, describe the behavior, and find related code.</p></div></div>
        <section className="repo-intake card"><div className="repo-intake-icon"><Upload size={17}/></div><div className="repo-intake-copy"><b>{repository ? repository.filename : 'Start with your project ZIP'}</b><small>{repository ? `${repository.source_file_count} readable files in this browser · ${repository.finding_count} simple code checks` : 'Upload a ZIP of your project. Then describe the bug or behavior you expected so DevPilot can find related files.'}</small>{uploadStatus&&<small className="upload-status">{uploadStatus}</small>}</div><label className="primary-btn upload-button"><input type="file" accept=".zip" onChange={handleUpload}/>{repository?'Choose another ZIP':'Upload project ZIP'} <ArrowRight size={14}/></label>{!repository&&<button className="sample-btn" onClick={loadSample}>Try included sample</button>}</section>
        {repository&&<RepositoryResults key={repositoryRevision} result={repository} onUpdate={setRepository} fontSize={fontSize} theme={theme} aiStatus={aiStatus}/>}
        {!repository&&<section className="empty-workspace card"><div className="empty-workspace-icon"><FileCode2 size={22}/></div><h2>Upload a project, then tell us what’s wrong</h2><p>The included sample lets you try the workflow. After upload, describe what you expected and what happened to find code that mentions related terms.</p><div className="capability-list"><span><CheckCircle2 size={13}/> Opens a code file first</span><span><CheckCircle2 size={13}/> Finds code matching your description</span><span><CheckCircle2 size={13}/> Shows simple code checks</span></div></section>}

        <footer><span><Box size={13}/> DevPilot AI <span>·</span> Repository workflow</span><span><LockKeyhole size={12}/> {aiStatus==='ready'?'AI model connected':'AI model not connected'} · Isolated tests unavailable</span></footer>
      </div></div>
      {settingsOpen&&<div className="settings-backdrop" onClick={()=>setSettingsOpen(false)}><section className="settings-panel" onClick={e=>e.stopPropagation()}><div className="settings-heading"><div><h2>Workspace settings</h2><p>Preferences are stored in this browser.</p></div><button onClick={()=>setSettingsOpen(false)} aria-label="Close settings"><X size={16}/></button></div><label className="setting-row"><span><b>Appearance</b><small>Choose the workspace color theme</small></span><select value={theme?'light':'dark'} onChange={e=>setTheme(e.target.value==='light')}><option value="dark">Dark</option><option value="light">Light</option></select></label><label className="setting-row"><span><b>Editor font size</b><small>Adjust code text size</small></span><select value={fontSize} onChange={e=>{const v=Number(e.target.value);setFontSize(v);localStorage.setItem('devpilot-editor-font-size',String(v))}}><option value={11}>11 px</option><option value={12}>12 px</option><option value={13}>13 px</option><option value={14}>14 px</option><option value={16}>16 px</option></select></label><div className="setting-note"><LockKeyhole size={13}/> {aiStatus==='ready'?'Model access is configured on the backend. Your provider key stays there.':'Configure a model key on the backend to enable AI. Isolated test execution is not connected.'}</div></section></div>}
    </main>
  </div>
}
const studioColors=[{id:'violet',label:'Violet',value:'#7464e8'},{id:'blue',label:'Blue',value:'#3978d4'},{id:'green',label:'Green',value:'#26876e'},{id:'rose',label:'Rose',value:'#c2517b'}]
function Stat({icon,label,value,detail,tone}:{icon:React.ReactNode,label:string,value:string,detail:React.ReactNode,tone:string}) { return <div className="card stat-card"><div className={'stat-icon '+tone}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div></div> }
function ActivityItem({icon,tone,title,info,time}:{icon:React.ReactNode,tone:string,title:string,info:string,time:string}) { return <div className="activity-item"><div className={'activity-icon '+tone}>{icon}</div><div className="activity-copy"><b>{title}</b><small>{info}</small></div><time>{time}</time></div> }
function RepositoryResults({result,onUpdate,fontSize,theme,aiStatus}:{result:ScanResult;onUpdate:(result:ScanResult)=>void;fontSize:number;theme:boolean;aiStatus:'checking'|'ready'|'offline'|'unconfigured'}) {
  const originalFiles=useRef(result.source_files)
  const [sourceFiles,setSourceFiles]=useState(result.source_files)
  const firstFile=result.source_files.find(item=>!['md','txt'].includes(item.language))||result.source_files[0]
  const [selected,setSelected]=useState(firstFile?.path||'')
  const [draft,setDraft]=useState(firstFile?.content||'')
  const [problem,setProblem]=useState('')
  const [triage,setTriage]=useState<ReturnType<typeof matchProblem>|null>(null)
  const [analysis,setAnalysis]=useState<ModelAnalysis|null>(null)
  const [analyzing,setAnalyzing]=useState(false)
  const [analysisMessage,setAnalysisMessage]=useState('')
  const [saved,setSaved]=useState(false)
  const file=sourceFiles.find(item=>item.path===selected)
  const dirty=!!file&&draft!==file.content
  useEffect(()=>{setDraft(file?.content||'');setSaved(false)},[selected])
  const save=()=>{if(!file||!dirty)return;const next=sourceFiles.map(item=>item.path===selected?{...item,content:draft}:item);setSourceFiles(next);onUpdate(analyzeSources(result.filename,next));setSaved(true)}
  const investigate=async()=>{if(!problem.trim())return;setAnalyzing(true);setAnalysisMessage('');setAnalysis(null);try{const relevant=matchProblem(problem,sourceFiles).matches.map(item=>item.file),ordered=[...relevant,...sourceFiles.filter(item=>!relevant.some(file=>file.path===item.path))];let budget=280_000;const context=ordered.slice(0,100).flatMap(item=>{if(budget<=0)return[];const content=item.content.slice(0,budget);budget-=content.length;return content?[{path:item.path,content}]:[]});const response=await fetch('/api/debug/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({problem,files:context})});const data=await response.json().catch(()=>({detail:''}));if(!response.ok)throw new Error(data.detail||(response.status>=500?'AI service is offline. Start the FastAPI backend on port 8000 and configure its provider key.':'AI investigation failed.'));setAnalysis(data.analysis as ModelAnalysis)}catch(error){setAnalysisMessage((error as Error).message.includes('Failed to fetch')?'AI service is offline. Start the FastAPI backend on port 8000 and configure its provider key.':(error as Error).message)}finally{setAnalyzing(false)}}
  const applySuggestedPatch=(patch:ModelAnalysis['patches'][number])=>{const target=sourceFiles.find(item=>item.path===patch.path);if(!target){setAnalysisMessage(`File ${patch.path} is no longer loaded.`);return}const lines=target.content.split(/\r?\n/),start=Math.max(0,patch.start_line-1),oldLines=patch.before.split('\n');if(lines.slice(start,start+oldLines.length).join('\n')!==patch.before){setAnalysisMessage(`Patch for ${patch.path} was not applied because its original text no longer matches.`);return}const nextContent=[...lines.slice(0,start),...patch.after.split('\n'),...lines.slice(start+oldLines.length)].join('\n'),next=sourceFiles.map(item=>item.path===patch.path?{...item,content:nextContent}:item);setSourceFiles(next);setSelected(patch.path);setDraft(nextContent);onUpdate(analyzeSources(result.filename,next));setAnalysisMessage(`Applied the suggested change to ${patch.path} in this browser session. Download the file to keep it.`)}
  const revert=()=>{const original=originalFiles.current.find(item=>item.path===selected);if(!original)return;const next=sourceFiles.map(item=>item.path===selected?original:item);setSourceFiles(next);setDraft(original.content);onUpdate(analyzeSources(result.filename,next));setSaved(false)}
  const download=()=>{if(!file)return;const blob=new Blob([draft],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=file.path.split('/').pop()||'source.txt';a.click();URL.revokeObjectURL(url)}
  const warnings = result.findings.filter(f=>f.severity==='warning').length
  return <section className="repo-results card"><div className="repo-results-head"><div><span className="eyebrow">LOCAL REPOSITORY REVIEW</span><h2>{result.filename}</h2><p>{result.source_file_count} readable files loaded. Describe the behavior you expected and this browser will search the code for related terms. Local matching is available now. AI investigation requires a configured model.</p></div><div className="scan-badges"><span>{result.source_file_count} files</span><span className={warnings?'badge-error':'badge-ok'}>{warnings} code checks</span></div></div>{result.source_file_count===0?<div className="empty-scan">No supported source files were found in this ZIP. Supported extensions include Python, JavaScript, TypeScript, Java, C/C++, JSON, YAML, TOML, and text files.</div>:<><section className="problem-triage"><label htmlFor="problem-statement">What problem are you trying to solve?</label><p>Describe what happens and what you expected. Example: “Login works once, but refreshing the page signs me out.”</p><div className="problem-input-row"><textarea id="problem-statement" value={problem} onChange={e=>setProblem(e.target.value)} placeholder="Describe the problem in your own words…" rows={3}/><div className="problem-actions"><button className="sample-btn" disabled={!problem.trim()} onClick={()=>setTriage(matchProblem(problem,sourceFiles))}>Find matching code</button><button className="primary-btn" disabled={!problem.trim()||analyzing} onClick={investigate}>{analyzing?'Investigating…':'Investigate with AI'} <ArrowRight size={14}/></button></div></div><small className="provider-consent">AI investigation sends the problem statement and repository files to the model configured on your backend.</small>{analysisMessage&&<div className="analysis-message" role="status">{analysisMessage}</div>}{analysis&&<section className="model-report"><div className="model-report-title"><span>AI INVESTIGATION</span><b>{analysis.confidence} confidence</b></div><h3>{analysis.summary}</h3><p>{analysis.root_cause}</p><h4>Evidence in your repository</h4>{analysis.evidence.map((item,index)=><button className="evidence-card" key={`${item.path}:${item.line}:${index}`} onClick={()=>setSelected(item.path)}><b>{item.path}:{item.line}</b><code>{item.snippet}</code><span>{item.explanation}</span></button>)}{analysis.patches.map((patch,index)=><div className="patch-card" key={`${patch.path}:${index}`}><div><b>Suggested change · {patch.path}:{patch.start_line}</b><span>{patch.reason}</span></div><div className="patch-diff"><pre className="patch-before">− {patch.before}</pre><pre className="patch-after">+ {patch.after}</pre></div><button className="primary-btn" onClick={()=>applySuggestedPatch(patch)}>Apply this change</button></div>)}{analysis.tests_to_run?.length>0&&<div className="test-suggestions"><b>Tests to run</b>{analysis.tests_to_run.map((test,index)=><code key={index}>{test}</code>)}<small>Suggested only. Tests have not been executed.</small></div>}{analysis.limitations&&<p className="analysis-limitations">{analysis.limitations}</p>}</section>}{triage&&<div className="triage-results"><b>Your problem statement</b><blockquote>{problem}</blockquote><b>Local code search</b>{triage.matches.length?<><span>Search terms: {triage.terms.join(', ')||'no searchable terms'}</span>{triage.matches.map(({file,terms})=><button key={file.path} onClick={()=>setSelected(file.path)}><FileCode2 size={14}/><strong>{file.path}</strong><small>Matched: {terms.slice(0,5).map(t=>t.term).join(', ')}</small></button>)}</>:<p>No matching words were found in the source files. Try describing a visible symptom or the name of the feature. This tool cannot identify a cause without a matching code path.</p>}</div>}</section><div className="scan-grid"><div className="scan-files"><div className="scan-file-heading"><div className="scan-label">FILES · {result.source_file_count}</div></div>{sourceFiles.map(item=><button key={item.path} className={selected===item.path?'scan-file active':'scan-file'} onClick={()=>setSelected(item.path)}><FileCode2 size={13}/><span>{item.path}</span></button>)}</div><div className="scan-detail"><div className="editor-toolbar"><span className="scan-label">{file?.path||'SOURCE FILE'} {dirty&&<b className="unsaved-tag">UNSAVED</b>}</span><div><button onClick={revert} disabled={!file||(!dirty&&file.content===originalFiles.current.find(item=>item.path===selected)?.content)}>Revert</button><button onClick={download} disabled={!file}>Download file</button><button className="save-edit" onClick={save} disabled={!dirty}>{saved?'Saved':'Save changes'}</button></div></div><Editor height="320px" language={editorLanguage(file?.path||'')} theme={theme?'vs':'vs-dark'} value={draft} onChange={value=>{setDraft(value||'');setSaved(false)}} options={{readOnly:false,minimap:{enabled:false},fontSize,lineNumbers:'on',scrollBeyondLastLine:false,wordWrap:'on',padding:{top:12},fontFamily:'JetBrains Mono, Consolas, monospace',automaticLayout:true}}/><div className="editor-help">Edit the file, then save to update code checks. Download file exports the selected content. The ZIP itself stays unchanged.</div></div></div></>}
    <div className="scan-findings"><div className="scan-label">STATIC FINDINGS · {result.finding_count}</div>{result.findings.length?result.findings.map((f,i)=><div className="finding-row" key={`${f.path}:${f.line}:${f.rule}:${i}`}><span className={f.severity==='error'?'finding-mark error':'finding-mark'}>{f.severity==='error'?<X size={13}/>:<AlertTriangle size={13}/>}</span><div><b>{f.message}</b><small>{f.rule}</small></div><button onClick={()=>setSelected(f.path)}>{f.path}:{f.line} <ArrowRight size={12}/></button></div>):<div className="empty-findings"><CheckCircle2 size={14}/> No findings from the enabled static checks. This is not a full security audit or test run.</div>}</div>
  </section>
}
function editorLanguage(path:string){const ext=path.split('.').pop()?.toLowerCase();return ({py:'python',js:'javascript',jsx:'javascript',ts:'typescript',tsx:'typescript',java:'java',c:'c',h:'c',cpp:'cpp',hpp:'cpp',json:'json',yml:'yaml',yaml:'yaml',md:'markdown'} as Record<string,string>)[ext||'']||'plaintext'}
function InterfaceStudio({onExit}:{onExit:()=>void}) {
  const savedConfig=(()=>{try{return JSON.parse(localStorage.getItem('devpilot-interface')||'{}')}catch{return {}}})()
  const [color,setColor]=useState(studioColors.some(item=>item.id===savedConfig.color)?savedConfig.color:'violet')
  const [density,setDensity]=useState(savedConfig.density==='compact'?'compact':'comfortable')
  const [saved,setSaved]=useState(!!localStorage.getItem('devpilot-interface'))
  const apply=(nextColor:string,nextDensity:string)=>{const chosen=studioColors.find(item=>item.id===nextColor)||studioColors[0];document.documentElement.style.setProperty('--studio-accent',chosen.value);document.body.dataset.density=nextDensity}
  const save=()=>{const config={color,density};localStorage.setItem('devpilot-interface',JSON.stringify(config));apply(color,density);setSaved(true)}
  const chooseColor=(id:string)=>{setColor(id);setSaved(false);apply(id,density)}
  const chooseDensity=(value:string)=>{setDensity(value);setSaved(false);apply(color,value)}
  useEffect(()=>{apply(color,density)},[])
  return <main className="studio-page"><div className="studio-toolbar"><button className="studio-back" onClick={onExit}><ArrowRight size={14}/> Back to workspace</button><span className="studio-brand"><span className="studio-orb"/> Interface Studio</span><span className="studio-state"><i className={saved?'':'pending'}/>{saved?'Changes saved':'Unsaved changes'}</span></div><div className="studio-content studio-workspace-content"><div className="studio-note"><span className="studio-note-icon">✦</span><span>Change the workspace accent and spacing. The preview updates immediately.</span></div><section className="workspace-preview" aria-label="Live workspace preview"><aside><b><i>&lt;/&gt;</i> devpilot<span>.ai</span></b><button className="preview-nav-active">▦ &nbsp; Repository scan</button><button>⚙ &nbsp; Interface Studio</button></aside><div className="workspace-preview-main"><span className="preview-overline">DEVPILOT AI / LOCAL SCAN</span><h2>Repository analysis</h2><p>Describe your problem and find related code in your repository.</p><div className="preview-card"><b>What problem are you trying to solve?</b><div>Describe the behavior you expected…</div><button>Find related code&nbsp; →</button></div></div></section><section className="studio-setting-card"><h2>Workspace accent</h2><p>Choose the highlight color used for active controls and actions.</p><div className="accent-options">{studioColors.map(item=><button key={item.id} aria-label={`${item.label} accent`} aria-pressed={color===item.id} onClick={()=>chooseColor(item.id)}><i style={{background:item.value}}/>{item.label}{color===item.id&&<Check size={14}/>}</button>)}</div></section><section className="studio-setting-card"><h2>Workspace spacing</h2><p>Choose how much space appears around navigation and panels.</p><div className="density-options"><button className={density==='comfortable'?'selected':''} onClick={()=>chooseDensity('comfortable')}><b>Comfortable</b><small>More room between items</small></button><button className={density==='compact'?'selected':''} onClick={()=>chooseDensity('compact')}><b>Compact</b><small>Fit more on the screen</small></button></div></section><div className="studio-save-row"><span>Saved choices apply to the workspace and stay in this browser.</span><button className="studio-save" onClick={save}>{saved?<><Check size={15}/> Saved</>:<>Save workspace style</>}</button></div></div></main>
}
export default App
