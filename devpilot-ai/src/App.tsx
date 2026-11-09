import { useState } from 'react'
import Editor from '@monaco-editor/react'
import { Activity, AlertTriangle, ArrowDown, ArrowRight, Bot, Box, Check, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, Clock3, Code2, Command, FileCode2, FileText, Folder, GitBranch, GitCommitHorizontal, GitPullRequest, LayoutDashboard, LockKeyhole, Menu, MessageSquare, MoreHorizontal, PanelLeftClose, Play, Plus, Search, Send, Settings2, Shield, Sparkles, Terminal, TestTube2, Upload, Workflow, X, Zap } from 'lucide-react'

const source = `from fastapi import FastAPI, HTTPException\nfrom app.services.users import get_user\n\napp = FastAPI()\n\n@app.get("/users/{user_id}")\ndef read_user(user_id: int):\n    user = get_user(user_id)\n    return user.email\n`
const nav = [
  { icon: LayoutDashboard, label: 'Overview' }, { icon: MessageSquare, label: 'AI Engineer' },
  { icon: Workflow, label: 'Root cause graph' }, { icon: TestTube2, label: 'Test runs', count: '3' },
  { icon: Shield, label: 'Security audit' },
]
const files = ['app.py','services/users.py','models/user.py','tests/test_users.py']

function App() {
  const [active, setActive] = useState('Overview')
  const [selected, setSelected] = useState('app.py')
  const [prompt, setPrompt] = useState('')
  const [message, setMessage] = useState('')
  const [uploaded, setUploaded] = useState('')
  const [uploadStatus, setUploadStatus] = useState('')
  const [sidebar, setSidebar] = useState(true)
  const [theme, setTheme] = useState(false)
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setUploaded(f.name); setUploadStatus('Sending archive to local API…')
    const body = new FormData(); body.append('file', f)
    try {
      const response = await fetch('http://localhost:8000/api/repositories/upload', { method: 'POST', body })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Upload failed')
      setUploadStatus(`Intake complete · ${data.source_file_count} source paths listed · no analysis run`)
    } catch (err) {
      setUploadStatus(err instanceof TypeError ? 'API unavailable · start the FastAPI service on port 8000' : (err as Error).message)
    }
  }
  const run = () => setUploadStatus('Test execution is unavailable in this preview; no tests were run.')
  return <div className={theme ? 'app light' : 'app'}>
    <aside className={sidebar ? 'sidebar' : 'sidebar collapsed'}>
      <div className="brand"><div className="brand-mark"><Code2 size={18}/></div><span>devpilot<span className="brand-ai">.ai</span></span><button className="icon-btn sidebar-toggle" onClick={()=>setSidebar(!sidebar)}><PanelLeftClose size={16}/></button></div>
      <button className="repo-select"><div className="repo-avatar">N</div><span className="repo-name"><b>northstar-api</b><small>Acme Inc. · Pro plan</small></span><ChevronDown size={15}/></button>
      <div className="nav-label">WORKSPACE</div>
      <nav>{nav.map(n=><button key={n.label} className={'nav-item '+(active===n.label?'active':'')} onClick={()=>setActive(n.label)}><n.icon size={17}/><span>{n.label}</span>{n.count&&<small className="nav-count">{n.count}</small>}</button>)}</nav>
      <div className="nav-label files-label">PROJECT FILES <button className="tiny-icon"><Plus size={13}/></button></div>
      <div className="tree-root"><ChevronDown size={13}/><Folder size={15} className="folder-icon"/><span>northstar-api</span></div>
      {files.map((f,i)=><button key={f} onClick={()=>setSelected(f)} className={'tree-file '+(selected===f?'selected':'')}><FileCode2 size={14}/><span>{f}</span>{i===0&&<i className="dirty-dot"/>}</button>)}
      <div className="sidebar-bottom"><div className="plan-card"><div className="plan-head"><span><Zap size={13}/> Agent credits</span><b>72%</b></div><div className="progress"><i/></div><small>720 of 1,000 credits left</small><button>Upgrade plan <ArrowRight size={13}/></button></div>
        <button className="nav-item" onClick={()=>setTheme(!theme)}><Settings2 size={17}/><span>Settings</span><span className="kbd">⌘ ,</span></button><div className="profile"><div className="avatar">JD</div><div><b>Jordan Davis</b><small>jordan@acme.dev</small></div><MoreHorizontal size={17}/></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs"><button className="icon-btn mobile-menu" onClick={()=>setSidebar(!sidebar)}><Menu size={17}/></button><span>northstar-api</span><ChevronRight size={14}/><b>{active==='Overview'?'Overview':active}</b></div><div className="top-actions"><div className="branch"><GitBranch size={14}/> main <ChevronDown size={13}/></div><div className="top-divider"/><button className="icon-btn" title="Search"><Search size={17}/></button><button className="icon-btn" title="Help"><CircleHelp size={17}/></button><div className="avatar small-avatar">JD</div></div></header>
      <div className="page-scroll"><div className="page-content">
        <div className="welcome-row"><div><div className="eyebrow"><span className="status-pulse"/> PROJECT WORKSPACE <span className="eyebrow-sep">/</span> <span>LAST INDEXED 4M AGO</span></div><h1>Good morning, Jordan <span className="wave">✳</span></h1><p className="subtitle">Your codebase is looking healthy. Here's what needs your attention.</p></div><button className="primary-btn" onClick={()=>setActive('AI Engineer')}><Sparkles size={15}/> New agent task <span className="kbd">⌘ K</span></button></div>
        <div className="demo-banner"><CircleHelp size={13}/><span>Sample workspace preview</span><span>Metrics, issue details, and investigation shown below are illustrative and are not analysis of an uploaded repository.</span></div>
        <div className="stats-grid"><Stat icon={<FileCode2/>} label="Files indexed" value="1,284" detail="Across 6 languages" tone="blue"/><Stat icon={<GitPullRequest/>} label="Open issues" value="08" detail={<><span className="red-dot"/> 3 need attention</>} tone="orange"/><Stat icon={<TestTube2/>} label="Test coverage" value="84.6%" detail={<><span className="green-text">↑ 2.4%</span> this week</>} tone="green"/><Stat icon={<Shield/>} label="Security score" value="A−" detail={<><span className="green-text">No critical findings</span></>} tone="purple"/></div>
        <div className="section-heading"><div><h2>Active investigation</h2><p>AI Engineer is tracing a reported error across your codebase.</p></div><button className="subtle-btn" onClick={()=>setActive('Root cause graph')}>View investigation <ArrowRight size={14}/></button></div>
        <section className="investigation card"><div className="invest-head"><div className="invest-title"><div className="bug-icon"><AlertTriangle size={17}/></div><div><div className="title-line"><h3>AttributeError in user profile endpoint</h3><span className="priority">HIGH PRIORITY</span></div><div className="issue-meta"><span><GitCommitHorizontal size={13}/> DEV-284</span><span>·</span><span>Reported by CI pipeline</span><span>·</span><span><Clock3 size={13}/> 12 min ago</span></div></div></div><button className="icon-btn"><MoreHorizontal size={18}/></button></div>
          <div className="invest-body"><div className="error-callout"><div className="error-top"><AlertTriangle size={14}/> <b>AttributeError</b><span>app/services/users.py:42</span><button onClick={()=>setSelected('services/users.py')}>Open file <ArrowRight size={12}/></button></div><code>'NoneType' object has no attribute 'email'</code></div>
          <div className="evidence-row"><span className="evidence-label"><Sparkles size={13}/> ROOT CAUSE EVIDENCE</span><span className="confidence"><span>Evidence strength</span><b>High</b><i><em/></i></span></div>
          <div className="evidence-graph"><div className="graph-node source-node"><span className="node-icon"><Terminal size={14}/></span><div><small>REQUEST</small><b>GET /users/{'{id}'}</b></div><span className="node-state">TRIGGER</span></div><div className="graph-link"><span/><ArrowDown size={13}/></div><div className="graph-node"><span className="node-icon blue-node"><Code2 size={14}/></span><div><small>FUNCTION CALL <span>app.py:7</span></small><b>get_user(user_id)</b></div><span className="node-arrow"><ArrowRight size={14}/></span></div><div className="graph-link"><span/><ArrowDown size={13}/></div><div className="graph-node cause-node"><span className="node-icon orange-node"><AlertTriangle size={14}/></span><div><small>ROOT CAUSE <span>users.py:42</span></small><b>Database lookup returns None</b></div><span className="impact">NULL RETURN</span></div></div>
          <div className="invest-footer"><span><CheckCircle2 size={14}/> 3 code references verified</span><button className="subtle-btn" onClick={()=>setActive('AI Engineer')}>Review diagnosis <ArrowRight size={14}/></button></div></div></section>
        <div className="lower-grid"><section className="card editor-card"><div className="panel-head"><div className="panel-title"><Code2 size={16}/><b>Code context</b><span className="file-pill"><FileCode2 size={12}/>{selected}</span></div><button className="subtle-btn small-subtle" onClick={()=>setSelected('services/users.py')}>Open in editor <ArrowRight size={13}/></button></div><div className="editor-wrap"><Editor height="245px" language="python" theme="vs-dark" value={source} options={{readOnly:true,minimap:{enabled:false},fontSize:12,lineNumbers:'on',scrollBeyondLastLine:false,renderLineHighlight:'line',overviewRulerBorder:false,hideCursorInOverviewRuler:true,wordWrap:'on',padding:{top:14},fontFamily:'JetBrains Mono, Consolas, monospace'}}/></div><div className="editor-foot"><span><span className="red-dot"/> Line 8 · potential null reference</span><span>Python 3.12</span></div></section>
        <section className="card agent-card"><div className="panel-head"><div className="panel-title"><div className="agent-mark"><Bot size={14}/></div><b>AI Engineer</b><span className="online-pill"><i/> READY</span></div><button className="icon-btn"><MoreHorizontal size={17}/></button></div><div className="agent-convo"><div className="ai-message"><div className="agent-mark"><Bot size={13}/></div><div><b>Investigation complete</b><p>The <code>get_user()</code> lookup can return <code>None</code> when an ID doesn't exist. The endpoint accesses <code>.email</code> without checking the result first.</p><div className="message-tags"><span><FileCode2 size={11}/> 2 files affected</span><span><CheckCircle2 size={11}/> Evidence linked</span></div></div></div>{message&&<div className="user-message">{message}</div>}<div className="agent-suggestion"><Sparkles size={13}/><span>Suggested: add a 404 response and regression test</span><ChevronRight size={14}/></div></div><div className="chat-input"><input value={prompt} onChange={e=>setPrompt(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&prompt.trim()){setMessage(prompt);setPrompt('')}}} placeholder="Ask about this investigation..."/><button onClick={()=>{if(prompt.trim()){setMessage(prompt);setPrompt('')}}}><Send size={15}/></button></div><div className="agent-disclaimer"><LockKeyhole size={11}/> Demo workspace · No code is executed or changed</div></section></div>
        <div className="bottom-row"><section className="card activity-card"><div className="panel-head"><div className="panel-title"><Activity size={15}/><b>Recent activity</b><span className="demo-tag">SAMPLE</span></div><button className="subtle-btn small-subtle">View all <ArrowRight size={13}/></button></div><ActivityItem icon={<Check size={13}/>} tone="green" title="Repository indexing complete" info="1,284 files · 6 languages" time="4m ago"/><ActivityItem icon={<GitCommitHorizontal size={14}/>} tone="blue" title="Commit analyzed" info="a83f2c1 · Add user preferences endpoint" time="1h ago"/><ActivityItem icon={<TestTube2 size={13}/>} tone="purple" title="Test suite passed" info="246 tests · 18.4s" time="2h ago"/></section>
          <section className="card quick-card"><div className="panel-head"><div className="panel-title"><Command size={15}/><b>Quick start</b></div></div><label className="upload-box"><input type="file" accept=".zip" onChange={handleUpload}/><span className="upload-icon"><Upload size={17}/></span><span><b>{uploaded||'Add a repository'}</b><small>{uploadStatus||'ZIP upload · API intake only'}</small></span><Plus size={16}/></label><button className="quick-action" onClick={()=>setActive('AI Engineer')}><MessageSquare size={15}/><span>Ask AI about your codebase</span><span className="quick-status">Preview</span></button><button className="quick-action" onClick={run}><Play size={15}/><span>Run test suite</span><span className="quick-status">Unavailable</span></button></section></div>
        <footer><span><Box size={13}/> DevPilot AI <span>·</span> Workspace demo</span><span><LockKeyhole size={12}/> Sandbox execution unavailable in this preview <span>·</span> <button onClick={()=>setTheme(!theme)}>Toggle {theme?'dark':'light'} theme</button></span></footer>
      </div></div>
    </main>
  </div>
}
function Stat({icon,label,value,detail,tone}:{icon:React.ReactNode,label:string,value:string,detail:React.ReactNode,tone:string}) { return <div className="card stat-card"><div className={'stat-icon '+tone}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div></div> }
function ActivityItem({icon,tone,title,info,time}:{icon:React.ReactNode,tone:string,title:string,info:string,time:string}) { return <div className="activity-item"><div className={'activity-icon '+tone}>{icon}</div><div className="activity-copy"><b>{title}</b><small>{info}</small></div><time>{time}</time></div> }
export default App
