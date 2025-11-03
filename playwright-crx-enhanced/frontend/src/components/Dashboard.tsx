import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import ApiTesting from './ApiTesting';
import ScriptCueCards from './ScriptCueCards';
import './Dashboard.css';

const API_URL = 'http://localhost:3001/api';

interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
}

interface Script {
  id: string;
  name: string;
  language: string;
  description?: string;
  createdAt: string;
  user: { name: string; email: string };
  project?: { name: string } | null;
  projectId?: string;
}

interface TestRun {
  id: string;
  status: string;
  duration?: number;
  startedAt: string;
  executionReportUrl?: string;
  script: { name: string };
}

interface HealingSuggestion {
  id: string;
  brokenLocator: string;
  validLocator: string;
  confidence: number;
  status: 'pending' | 'approved' | 'rejected';
  scriptName?: string;
  createdAt: string;
}

// Self-healing functionality removed

interface Stats {
  totalScripts: number;
  totalRuns: number;
  successRate: number;
  pendingHealing: number;
}

type ActiveView = 
  | 'overview' 
  | 'scripts' 
  | 'runs' 
  | 'healing' 
  | 'testdata' 
  | 'apitesting' 
  | 'allure'
  | 'analytics'
  | 'settings';

export const Dashboard: React.FC = () => {
  const [activeView, setActiveView] = useState<ActiveView>('overview');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [projectLoading, setProjectLoading] = useState(false);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  // Self-healing functionality removed
  const [stats, setStats] = useState<Stats>({ totalScripts: 0, totalRuns: 0, successRate: 0, pendingHealing: 0 });
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<AIAnalysisResult | null>(null);
  const [importingSample, setImportingSample] = useState(false);
  // Self-healing functionality removed
  // Self-healing functionality removed

  const token = localStorage.getItem('accessToken');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    // Reload data when project changes
    loadData();
  }, [selectedProjectId]);

  // Self-healing functionality removed

  const loadProjects = async () => {
    setProjectLoading(true);
    try {
      const res = await axios.get(`${API_URL}/projects`, { headers });
      const list: Project[] = res.data?.data || res.data?.projects || [];
      setProjects(list);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setProjectLoading(false);
    }
  };

  const importSampleScript = async () => {
    if (!token) {
      alert('Please log in to import a sample script');
      return;
    }
    setImportingSample(true);
    try {
      const sampleCode = `import { test, expect } from '@playwright/test';
test('sample login flow', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page.locator('h1')).toContainText('Example');
});\n`;
      const payload = {
        name: `Sample Script ${new Date().toLocaleTimeString()}`,
        description: 'Starter script imported from UI',
        language: 'typescript',
        code: sampleCode,
        projectId: selectedProjectId || null,
      };
      await axios.post(`${API_URL}/scripts`, payload, { headers });
      await loadData();
    } catch (error: any) {
      alert('Failed to import sample script: ' + (error?.response?.data?.error || error?.message || 'Unknown error'));
    } finally {
      setImportingSample(false);
    }
  };

  const createProject = async () => {
    if (!newProjectName.trim()) {
      alert('Project name is required');
      return;
    }
    setProjectLoading(true);
    try {
      const res = await axios.post(
        `${API_URL}/projects`,
        { name: newProjectName.trim(), description: newProjectDescription.trim() || undefined },
        { headers }
      );
      const created: Project = res.data?.data || res.data?.project;
      await loadProjects();
      if (created?.id) setSelectedProjectId(created.id);
      setNewProjectName('');
      setNewProjectDescription('');
    } catch (error: any) {
      console.error('Error creating project:', error);
      alert('Failed to create project: ' + (error.response?.data?.error || error.message));
    } finally {
      setProjectLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [scriptsRes, runsRes, healingRes] = await Promise.all([
        axios.get(`${API_URL}/scripts`, { headers, params: { projectId: selectedProjectId || undefined } }),
        axios.get(`${API_URL}/test-runs`, { headers, params: { projectId: selectedProjectId || undefined } }),
        // Self-healing functionality removed
      ]);

      const scriptData = scriptsRes.data.scripts || scriptsRes.data.data || [];
      const runData = runsRes.data.data || runsRes.data.testRuns || [];
      const healingData = healingRes.data.suggestions || [];

      setScripts(scriptData);
      setTestRuns(runData);
      setHealingSuggestions(healingData);

      const successCount = runData.filter((r: TestRun) => r.status === 'passed').length;
      setStats({
        totalScripts: scriptData.length,
        totalRuns: runData.length,
        successRate: runData.length > 0 ? Math.round((successCount / runData.length) * 100) : 0,
        pendingHealing: 0
      });
    } catch (error: any) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateExecutionReport = async (testRunId: string) => {
    setGeneratingReport(testRunId);
    try {
      const response = await axios.post(`${API_URL}/allure/generate/${testRunId}`, {}, { headers });
      await loadData();
      setSelectedReport(response.data.reportUrl);
      setActiveView('allure');
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setGeneratingReport(null);
    }
  };

  const approveSuggestion = async (id: string) => {
    try {
      // Self-healing functionality removed
      await loadData();
    } catch (error) {
      console.error('Error approving suggestion:', error);
    }
  };

  const rejectSuggestion = async (id: string) => {
    try {
      // Self-healing functionality removed
      await loadData();
    } catch (error) {
      console.error('Error rejecting suggestion:', error);
    }
  };

  // Self-healing functionality removed

  // AI Healing removed

  const menuItems = [
    { id: 'overview', icon: '📊', label: 'Project Overview', category: 'Main' },
    { id: 'scripts', icon: '📝', label: 'Scripts', category: 'Test Management' },
    { id: 'runs', icon: '▶️', label: 'Test Runs', category: 'Test Management' },
    { id: 'testdata', icon: '🗄️', label: 'Test Data', category: 'Data Management' },
    { id: 'apitesting', icon: '🔌', label: 'API Testing', category: 'Testing Tools' },
    { id: 'allure', icon: '📈', label: 'Execution Reports', category: 'Reports' },
    { id: 'analytics', icon: '📉', label: 'Analytics', category: 'Reports' },
    { id: 'settings', icon: '⚙️', label: 'Settings', category: 'System' }
  ];

  const groupedMenuItems = menuItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof menuItems>);

  const currentProjectName = selectedProjectId
    ? projects.find(p => p.id === selectedProjectId)?.name || 'Unknown Project'
    : 'No Project';

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className={`dashboard-sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>🎭 Playwright CRX</h2>
          <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? '✕' : '☰'}
          </button>
          <button
            className="btn-secondary"
            style={{ marginLeft: 8 }}
            onClick={() => {
              localStorage.removeItem('accessToken');
              window.location.reload();
            }}
          >
            🚪 Logout
          </button>
        </div>

        {/* Project badge */}
        <div className="project-badge" style={{ padding: '8px 12px', color: '#888' }}>
          Project: <strong>{currentProjectName}</strong>
        </div>

        <nav className="sidebar-nav">
          {Object.entries(groupedMenuItems).map(([category, items]) => (
            <div key={category} className="nav-category">
              <div className="category-label">{category}</div>
              {items.map((item) => (
                <button
                  key={item.id}
                  className={`nav-item ${activeView === item.id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveView(item.id as ActiveView);
                    setMenuOpen(false);
                  }}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="nav-badge">{item.badge}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        <div className="dashboard-content">
          {/* Overview */}
          {activeView === 'overview' && (
            <div className="view-container">
              <h1 className="view-title">Project Overview</h1>

              {/* Project Controls */}
              <div className="project-controls" style={{ marginBottom: 24 }}>
                <h2>Project</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="content-card">
                    <div className="form-group">
                      <label>Selected Project</label>
                      <select
                        value={selectedProjectId || ''}
                        onChange={(e) => setSelectedProjectId(e.target.value || null)}
                        disabled={projectLoading}
                        className="form-select"
                      >
                        <option value="">All Projects</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-secondary" onClick={loadProjects} disabled={projectLoading}>
                        {projectLoading ? '🔄 Refreshing...' : '🔄 Refresh'}
                      </button>
                      <button className="btn-secondary" onClick={loadData} disabled={loading}>
                        {loading ? '⏳ Loading...' : '↻ Reload Data'}
                      </button>
                    </div>
                  </div>

                  <div className="content-card">
                    <h3>Create Project</h3>
                    <div className="form-group">
                      <label>Project Name</label>
                      <input
                        type="text"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        placeholder="e.g., Checkout Flow"
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Description (optional)</label>
                      <textarea
                        value={newProjectDescription}
                        onChange={(e) => setNewProjectDescription(e.target.value)}
                        placeholder="Short description"
                        className="form-textarea"
                        rows={3}
                      />
                    </div>
                    <button className="btn-primary" onClick={createProject} disabled={projectLoading}>
                      {projectLoading ? '⏳ Creating...' : '➕ Create Project'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="quick-actions">
                <h2>Quick Actions</h2>
                <div className="action-grid">
                  <button className="action-card" onClick={() => setActiveView('scripts')}>
                    <span className="action-icon">📝</span>
                    <span className="action-label">View Scripts</span>
                  </button>
                  <button className="action-card" onClick={() => setActiveView('runs')}>
                    <span className="action-icon">▶️</span>
                    <span className="action-label">Test Runs</span>
                  </button>
                  <button className="action-card" onClick={() => setActiveView('apitesting')}>
                    <span className="action-icon">🔌</span>
                    <span className="action-label">API Testing</span>
                  </button>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="recent-activity">
                <h2>Recent Test Runs</h2>
                <div className="activity-list">
                  {testRuns.slice(0, 5).map((run) => (
                    <div key={run.id} className="activity-item">
                      <div className="activity-icon">
                        {run.status === 'passed' ? '✅' : run.status === 'failed' ? '❌' : '⏳'}
                      </div>
                      <div className="activity-content">
                        <div className="activity-title">{run.script.name}</div>
                        <div className="activity-meta">
                          {new Date(run.startedAt).toLocaleString()}
                          {run.duration && ` • ${run.duration}ms`}
                        </div>
                      </div>
                      <span className={`status-badge ${run.status}`}>{run.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Scripts View */}
          {activeView === 'scripts' && (
          <div className="view-container">
            <h1 className="view-title">Test Scripts</h1>
            <div style={{ marginBottom: 12, color: '#666' }}>
              Filter: <strong>{selectedProjectId ? currentProjectName : 'All Projects'}</strong>
              {selectedProjectId && (
                <button
                  className="btn-link"
                  style={{ marginLeft: 8, padding: 0, border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer' }}
                  onClick={() => setSelectedProjectId(null)}
                  title="Clear project filter"
                >
                  Clear Filter
                </button>
              )}
              <button
                className="btn-secondary"
                style={{ marginLeft: 12 }}
                onClick={importSampleScript}
                disabled={importingSample || loading}
                title="Import a starter script"
              >
                {importingSample ? '⏳ Importing...' : '⬇️ Import Sample Script'}
              </button>
            </div>
            {loading ? (
              <div className="loading-state">Loading scripts...</div>
            ) : scripts.length === 0 ? (
              selectedProjectId ? (
                <>
                  <div className="empty-state">
                    <div className="empty-icon">🔍</div>
                    <h3>No scripts in "{currentProjectName}"</h3>
                    <p>Try viewing all projects or record a script in this project.</p>
                    <button
                      className="btn-secondary"
                      onClick={() => setSelectedProjectId(null)}
                    >
                      ↩ Show All Projects
                    </button>
                  </div>

                  {/* Default workflow when no scripts exist */}
                  <div className="content-card" style={{ marginTop: 16 }}>
                    <div className="card-header">
                      <h3>New Script Workflow</h3>
                      <span className="language-badge">typescript</span>
                    </div>
                    <p className="card-description">Start a script even if none exist yet.</p>
                    <ScriptCueCards
                      script={{ id: 'new', name: 'New Script', language: 'typescript' }}
                      onGenerate={importSampleScript}
                      onEnhance={() => setActiveView('aihealing')}
                      onValidate={() => alert('Open review flow coming soon')}
                      onFinalize={() => setActiveView('runs')}
                      onInsights={() => setActiveView('analytics')}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="empty-state">
                    <div className="empty-icon">📝</div>
                    <h3>No Scripts Found</h3>
                    <p>Record some tests using the extension to get started!</p>
                    <button
                      className="btn-primary"
                      onClick={importSampleScript}
                      disabled={importingSample || loading}
                      title="Import a starter script"
                      style={{ marginTop: 8 }}
                    >
                      {importingSample ? '⏳ Importing...' : '⬇️ Import Sample Script'}
                    </button>
                  </div>

                  {/* Default workflow when no scripts exist */}
                  <div className="content-card" style={{ marginTop: 16 }}>
                    <div className="card-header">
                      <h3>New Script Workflow</h3>
                      <span className="language-badge">typescript</span>
                    </div>
                    <p className="card-description">Start a script even if none exist yet.</p>
                    <ScriptCueCards
                      script={{ id: 'new', name: 'New Script', language: 'typescript' }}
                      onGenerate={importSampleScript}
                      onEnhance={() => setActiveView('aihealing')}
                      onValidate={() => alert('Open review flow coming soon')}
                      onFinalize={() => setActiveView('runs')}
                      onInsights={() => setActiveView('analytics')}
                    />
                  </div>
                </>
              )
            ) : (
              (() => {
                const grouped = (scripts || []).reduce((acc: Record<string, typeof scripts>, s) => {
                  const key = s.project?.name || 'No Project';
                  (acc[key] = acc[key] || []).push(s);
                  return acc;
                }, {});

                return (
                  <div>
                    {Object.entries(grouped).map(([projectName, groupScripts]) => (
                      <div key={projectName} style={{ marginBottom: 24 }}>
                        <h2 style={{ margin: '8px 0' }}>{projectName}</h2>
                        <div className="cards-grid">
                          {groupScripts.map((script) => (
                            <div key={script.id} className="content-card">
                              <div className="card-header">
                                <h3>{script.name}</h3>
                                <span className="language-badge">{script.language}</span>
                              </div>
                              {script.description && (
                                <p className="card-description">{script.description}</p>
                              )}
                              <div className="card-meta">
                                <span>👤 User: {script.user.name}</span>
                                {script.user.email && <span>✉️ Email: {script.user.email}</span>}
                                {script.project?.name && (
                                  <span>
                                    📁 Project:
                                    <button
                                      className="btn-link"
                                      style={{ marginLeft: 4, padding: 0, border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer' }}
                                      onClick={() => script.projectId && setSelectedProjectId(script.projectId)}
                                      title="Filter by this project"
                                    >
                                      {script.project.name}
                                    </button>
                                  </span>
                                )}
                                <span>📅 {new Date(script.createdAt).toLocaleDateString()}</span>
                              </div>

                              {/* 5-Step Cue Cards */}
                              <ScriptCueCards
                                script={{ id: script.id, name: script.name, language: script.language }}
                                onGenerate={() => alert(`Generate flow for: ${script.name}`)}
                                onEnhance={() => setActiveView('aihealing')}
                                onValidate={() => alert(`Open review for: ${script.name}`)}
                                onFinalize={() => setActiveView('runs')}
                                onInsights={() => setActiveView('analytics')}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()
            )}
          </div>
          )}

          {/* Test Runs View */}
          {activeView === 'runs' && (
            <div className="view-container">
              <h1 className="view-title">Test Runs</h1>
              <div style={{ marginBottom: 12, color: '#666' }}>
                Filter: <strong>{selectedProjectId ? currentProjectName : 'All Projects'}</strong>
              </div>
              {loading ? (
                <div className="loading-state">Loading test runs...</div>
              ) : testRuns.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">▶️</div>
                  <h3>No Test Runs Yet</h3>
                  <p>Execute tests using the extension to see results here!</p>
                </div>
              ) : (
                <div className="runs-list">
                  {testRuns.map((run) => (
                    <div key={run.id} className="run-card">
                      <div className="run-header">
                        <div className="run-info">
                          <h3>{run.script.name}</h3>
                          <div className="run-meta">
                            <span className={`status-badge ${run.status}`}>{run.status}</span>
                            <span>🕒 {new Date(run.startedAt).toLocaleString()}</span>
                            {run.duration && <span>⏱️ {run.duration}ms</span>}
                          </div>
                        </div>
                        <div className="run-actions">
                          {run.executionReportUrl ? (
                            <button
                              className="btn-secondary"
                              onClick={() => {
                                setSelectedReport(run.executionReportUrl!);
                                setActiveView('allure');
                              }}
                            >
                              📊 View Report
                            </button>
                          ) : (
                            <button
                              className="btn-primary"
                              onClick={() => generateExecutionReport(run.id)}
                              disabled={generatingReport === run.id}
                            >
                              {generatingReport === run.id ? '⏳ Generating...' : '📊 Generate Report'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Self-Healing View Removed */}

          {/* AI Healing */}
          {activeView === 'aihealing' && (
            <div className="view-container">
              <h1 className="view-title">🤖 AI-Powered Self-Healing</h1>
              {aiStats && (
                <div className="healing-stats">
                  <div className="healing-stat">
                    <span className="stat-number">{aiStats.totalAnalyzed}</span>
                    <span className="stat-text">Total Analyzed</span>
                  </div>
                  <div className="healing-stat approved">
                    <span className="stat-number">{aiStats.autoHealed}</span>
                    <span className="stat-text">Auto-Healed</span>
                  </div>
                  <div className="healing-stat pending">
                    <span className="stat-number">{aiStats.manualReview}</span>
                    <span className="stat-text">Manual Review</span>
                  </div>
                  <div className="healing-stat">
                    <span className="stat-number">{Math.round(aiStats.successRate)}%</span>
                    <span className="stat-text">Success Rate</span>
                  </div>
                  <div className="healing-stat">
                    <span className="stat-number">{Math.round(aiStats.avgConfidence * 100)}%</span>
                    <span className="stat-text">Avg Confidence</span>
                  </div>
                </div>
              )}

              <div className="ai-healing-intro">
                <div className="intro-card">
                  <h3>🔬 Live AI Analyzer</h3>
                  <p>Test the AI healing system by analyzing a broken locator in real-time.</p>

                  <div className="ai-test-form">
                    <div className="form-group">
                      <label>Broken Locator:</label>
                      <input
                        type="text"
                        value={testLocator}
                        onChange={(e) => setTestLocator(e.target.value)}
                        placeholder="e.g., button.submit-btn-12345 or //div[@id='old-id']"
                        className="form-input"
                      />
                    </div>

                    <div className="form-group">
                      <label>Locator Type:</label>
                      <select
                        value={testLocatorType}
                        onChange={(e) => setTestLocatorType(e.target.value)}
                        className="form-select"
                      >
                        <option value="css">CSS</option>
                        <option value="xpath">XPath</option>
                        <option value="playwright">Playwright</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Element Snapshot (JSON - Optional):</label>
                      <textarea
                        value={testElementSnapshot}
                        onChange={(e) => setTestElementSnapshot(e.target.value)}
                        placeholder={`{
  "tagName": "button",
  "textContent": "Submit",
  "attributes": {
    "data-testid": "submit-btn",
    "id": "submit-form",
    "aria-label": "Submit form"
  }
}`}
                        className="form-textarea"
                        rows={8}
                      />
                    </div>

                    <button
                      onClick={analyzeLocatorWithAI}
                      disabled={aiAnalyzing || !testLocator}
                      className="btn-primary"
                    >
                      {aiAnalyzing ? '🔄 Analyzing...' : '🔍 Analyze with AI'}
                    </button>
                  </div>

                  {aiAnalysisResult && (
                    <div className="ai-results">
                      <div className="results-header">
                        <h3>🎯 Analysis Results</h3>
                        <div className="confidence-badge" style={{
                          backgroundColor: aiAnalysisResult.confidence >= 0.85 ? '#10b981' :
                                          aiAnalysisResult.confidence >= 0.60 ? '#f59e0b' : '#ef4444'
                        }}>
                          {Math.round(aiAnalysisResult.confidence * 100)}% Confidence
                        </div>
                      </div>

                      <div className="result-action">
                        <strong>Recommended Action:</strong>
                        <span className={`action-badge ${aiAnalysisResult.recommendedAction}`}>
                          {aiAnalysisResult.recommendedAction === 'auto_fix' ? '✅ Auto-Fix' :
                           aiAnalysisResult.recommendedAction === 'manual_review' ? '⚠️ Manual Review' :
                           '❌ Ignore'}
                        </span>
                      </div>

                      <div className="suggestions-list">
                        <h4>💡 Top Suggestions:</h4>
                        {aiAnalysisResult.suggestedLocators.map((suggestion, idx) => (
                          <div key={idx} className="suggestion-card">
                            <div className="suggestion-header">
                              <span className="suggestion-rank">#{idx + 1}</span>
                              <span className="suggestion-score">
                                {Math.round(suggestion.score * 100)}%
                              </span>
                            </div>
                            <div className="suggestion-locator">
                              <code>{suggestion.locator}</code>
                              <span className="locator-type">{suggestion.type}</span>
                            </div>
                            <div className="suggestion-reasoning">
                              💭 {suggestion.reasoning}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="element-context">
                        <h4>📋 Element Context:</h4>
                        <p><strong>Tag:</strong> {aiAnalysisResult.elementContext.tag}</p>
                        {aiAnalysisResult.elementContext.text && (
                          <p><strong>Text:</strong> {aiAnalysisResult.elementContext.text}</p>
                        )}
                        <p><strong>Similar Elements:</strong> {aiAnalysisResult.similarElements}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="ai-features-grid">
                <div className="ai-feature-card">
                  <div className="feature-icon">🎯</div>
                  <h3>Smart Suggestions</h3>
                  <p>AI generates multiple locator options ranked by stability and uniqueness</p>
                </div>
                <div className="ai-feature-card">
                  <div className="feature-icon">📊</div>
                  <h3>Confidence Scores</h3>
                  <p>Each suggestion includes a confidence score to guide your decision</p>
                </div>
                <div className="ai-feature-card">
                  <div className="feature-icon">🔄</div>
                  <h3>Auto-Healing</h3>
                  <p>High-confidence suggestions can be applied automatically</p>
                </div>
                <div className="ai-feature-card">
                  <div className="feature-icon">🧠</div>
                  <h3>Learning System</h3>
                  <p>The AI learns from approved suggestions to improve future recommendations</p>
                </div>
              </div>

              <div className="ai-strategies">
                <h2>AI Healing Strategies</h2>
                <div className="strategies-list">
                  <div className="strategy-item">
                    <div className="strategy-priority high">Priority 1</div>
                    <div className="strategy-content">
                      <h4>Data Test IDs</h4>
                      <p>Looks for <code>data-testid</code> attributes - the most stable selectors</p>
                    </div>
                  </div>
                  <div className="strategy-item">
                    <div className="strategy-priority high">Priority 2</div>
                    <div className="strategy-content">
                      <h4>Unique IDs</h4>
                      <p>Identifies stable, non-dynamic ID attributes</p>
                    </div>
                  </div>
                  <div className="strategy-item">
                    <div className="strategy-priority medium">Priority 3</div>
                    <div className="strategy-content">
                      <h4>ARIA Labels</h4>
                      <p>Uses accessibility attributes for semantic selection</p>
                    </div>
                  </div>
                  <div className="strategy-item">
                    <div className="strategy-priority medium">Priority 4</div>
                    <div className="strategy-content">
                      <h4>Role-Based</h4>
                      <p>Leverages ARIA roles for interactive elements</p>
                    </div>
                  </div>
                  <div className="strategy-item">
                    <div className="strategy-priority medium">Priority 5</div>
                    <div className="strategy-content">
                      <h4>Text Content</h4>
                      <p>Uses visible text for human-readable selectors</p>
                    </div>
                  </div>
                  <div className="strategy-item">
                    <div className="strategy-priority low">Priority 6</div>
                    <div className="strategy-content">
                      <h4>Stable Classes</h4>
                      <p>Filters out dynamic classes to find stable ones</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="ai-demo-section">
                <h2>Try AI Healing</h2>
                <div className="demo-card">
                  <p className="demo-instructions">
                    To see AI healing in action:
                  </p>
                  <ol className="demo-steps">
                    <li>Go to the <strong>Self-Healing</strong> tab</li>
                    <li>Review pending suggestions</li>
                    <li>High-confidence suggestions (85%+) can be auto-approved</li>
                    <li>The AI learns from your approvals to improve future suggestions</li>
                  </ol>
                  <button 
                    className="btn-primary"
                    onClick={() => setActiveView('healing')}
                  >
                    View Self-Healing Suggestions
                  </button>
                </div>
              </div>

              <div className="ai-benefits">
                <h2>Benefits of AI Healing</h2>
                <div className="benefits-grid">
                  <div className="benefit-item">
                    <span className="benefit-icon">⚡</span>
                    <span className="benefit-text">Faster test maintenance</span>
                  </div>
                  <div className="benefit-item">
                    <span className="benefit-icon">🎯</span>
                    <span className="benefit-text">More reliable selectors</span>
                  </div>
                  <div className="benefit-item">
                    <span className="benefit-icon">🔧</span>
                    <span className="benefit-text">Reduced manual fixing</span>
                  </div>
                  <div className="benefit-item">
                    <span className="benefit-icon">📈</span>
                    <span className="benefit-text">Improved test stability</span>
                  </div>
                  <div className="benefit-item">
                    <span className="benefit-icon">🧠</span>
                    <span className="benefit-text">Continuous learning</span>
                  </div>
                  <div className="benefit-item">
                    <span className="benefit-icon">💰</span>
                    <span className="benefit-text">Lower maintenance costs</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Test Data Management */}
          {activeView === 'testdata' && (
            <div className="view-container">
              <h1 className="view-title">Test Data Management</h1>
              <div className="empty-state">
                <div className="empty-icon">🗄️</div>
                <h3>Test Data Management</h3>
                <p>Test data management features are currently being developed.</p>
                <p>This section will allow you to manage test data repositories, snapshots, and synthetic data generation.</p>
              </div>
            </div>
          )}

          {/* API Testing */}
          {activeView === 'apitesting' && <ApiTesting />}

          {/* Execution Reports */}
          {activeView === 'allure' && (
            <div className="view-container full-height">
              <h1 className="view-title">Execution Reports</h1>
              {selectedReport ? (
                <div className="report-viewer">
                  <div className="report-header">
                    <button className="btn-secondary" onClick={() => setSelectedReport(null)}>
                      ← Back to Runs
                    </button>
                  </div>
                  <iframe
                    src={`http://localhost:3001${selectedReport}`}
                    className="report-iframe"
                    title="Execution Report"
                  />
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">📊</div>
                  <h3>No Report Selected</h3>
                  <p>Generate or view an execution report from the Test Runs section.</p>
                  <button className="btn-primary" onClick={() => setActiveView('runs')}>
                    View Test Runs
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Analytics */}
          {activeView === 'analytics' && (
            <div className="view-container">
              <h1 className="view-title">Analytics</h1>
              <div className="empty-state">
                <div className="empty-icon">📉</div>
                <h3>Analytics Dashboard</h3>
                <p>Analytics and trend reports are under construction.</p>
              </div>
            </div>
          )}

          {/* Settings */}
          {activeView === 'settings' && (
            <div className="view-container">
              <h1 className="view-title">Settings</h1>
              <div className="empty-state">
                <div className="empty-icon">⚙️</div>
                <h3>System Settings</h3>
                <p>Configure system-wide settings, integrations, and defaults here.</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;