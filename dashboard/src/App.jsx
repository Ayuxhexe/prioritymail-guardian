import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE;

const getToken = () => localStorage.getItem('pm_token');
const authHeaders = () => ({
  'Authorization': `Bearer ${getToken()}`,
  'Content-Type': 'application/json'
});

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [monitoring, setMonitoring] = useState(true);
  const [rules, setRules] = useState([]);
  const [history, setHistory] = useState([]);
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const [activeAlarmData, setActiveAlarmData] = useState(null);
  
  // Rule Form State
  const [ruleName, setRuleName] = useState('');
  const [ruleType, setRuleType] = useState('sender');
  const [ruleValue, setRuleValue] = useState('');

  // ─── Data Fetchers ──────────────────────────────────────────
  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/rules`, { headers: authHeaders() });
      if (res.ok) setRules(await res.json());
    } catch (err) { console.error('Failed to fetch rules:', err); }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/alerts`, { headers: authHeaders() });
      if (res.ok) setHistory(await res.json());
    } catch (err) { console.error('Failed to fetch alerts:', err); }
  }, []);

  // ─── Auth & Init ────────────────────────────────────────────
  useEffect(() => {
    const initAuth = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token');
      
      if (urlToken) {
        localStorage.setItem('pm_token', urlToken);
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      const token = getToken();
      if (token) {
        try {
          const res = await fetch(`${API_BASE}/auth/profile`, { headers: authHeaders() });
          if (res.ok) {
            const profileData = await res.json();
            setUser(profileData);
          } else {
            localStorage.removeItem('pm_token');
          }
        } catch (err) {
          console.error('Failed to fetch profile:', err);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  // After user loads, fetch rules & alerts, and set up auto-refresh
  useEffect(() => {
    if (!user) return;
    fetchRules();
    fetchAlerts();

    // Auto-refresh alerts every 6 seconds to pick up new scanner detections
    const intervalId = setInterval(() => {
      fetchAlerts();
    }, 6000);

    return () => clearInterval(intervalId);
  }, [user, fetchRules, fetchAlerts]);

  // ─── Auth Actions ───────────────────────────────────────────
  const handleLogout = () => {
    localStorage.removeItem('pm_token');
    setUser(null);
  };

  const handleLoginRedirect = () => {
    window.location.href = `${API_BASE}/auth/google`;
  };

  // ─── Rule Actions ───────────────────────────────────────────
  const handleAddRule = async (e) => {
    e.preventDefault();
    if (!ruleName.trim()) return;
    if (ruleType !== 'is_important' && !ruleValue.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/rules`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          name: ruleName,
          type: ruleType,
          value: ruleType === 'is_important' ? 'Important' : ruleValue
        })
      });

      if (res.ok) {
        setRuleName('');
        setRuleValue('');
        fetchRules();
      }
    } catch (err) { console.error('Failed to add rule:', err); }
  };

  const handleDeleteRule = async (id) => {
    try {
      await fetch(`${API_BASE}/rules/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      fetchRules();
    } catch (err) { console.error('Failed to delete rule:', err); }
  };

  const toggleRule = async (id) => {
    try {
      await fetch(`${API_BASE}/rules/${id}`, {
        method: 'PUT',
        headers: authHeaders()
      });
      fetchRules();
    } catch (err) { console.error('Failed to toggle rule:', err); }
  };

  // ─── Monitoring Toggle ──────────────────────────────────────
  const handleToggleMonitoring = async () => {
    const newState = !monitoring;
    try {
      const res = await fetch(`${API_BASE}/alerts/settings`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ monitoringEnabled: newState })
      });
      if (res.ok) {
        setMonitoring(newState);
      }
    } catch (err) { console.error('Failed to toggle monitoring:', err); }
  };

  // ─── Alarm ──────────────────────────────────────────────────
  const playSynthAlarm = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      let time = audioCtx.currentTime;
      for (let i = 0; i < 4; i++) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, time);
        osc.frequency.exponentialRampToValueAtTime(440, time + 0.25);
        gain.gain.setValueAtTime(0.15, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
        osc.start(time);
        osc.stop(time + 0.3);
        time += 0.4;
      }
    } catch (err) {
      console.warn('AudioContext block:', err);
    }
  };

  const triggerTestAlarm = async () => {
    playSynthAlarm();

    try {
      const res = await fetch(`${API_BASE}/alerts/test`, {
        method: 'POST',
        headers: authHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setActiveAlarmData({
          sender: data.alert.sender,
          subject: data.alert.subject
        });
        setIsAlarmActive(true);
        fetchAlerts(); // Refresh history immediately
      }
    } catch (err) {
      // Fallback to local-only alarm
      setActiveAlarmData({ sender: 'hr@google.com', subject: 'Interview Schedule - Next Steps' });
      setIsAlarmActive(true);
    }
  };

  const dismissAlarm = () => {
    setIsAlarmActive(false);
    setActiveAlarmData(null);
  };

  // ─── Helper: relative time ──────────────────────────────────
  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  // ═══ LOADING ════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 font-semibold tracking-wider animate-pulse">SECURING CONNECTION...</p>
      </div>
    );
  }

  // ═══ LOGIN ══════════════════════════════════════════════════
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative overflow-hidden justify-between">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

        <header className="max-w-7xl mx-auto w-full px-6 py-8 flex justify-between items-center z-10">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🛡️</span>
            <span className="text-xl font-bold tracking-tight text-white">
              PriorityMail <span className="bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">Guardian</span>
            </span>
          </div>
        </header>

        <main className="max-w-md w-full mx-auto px-6 py-12 flex flex-col justify-center items-center text-center space-y-8 z-10">
          <div className="space-y-3">
            <div className="text-5xl mb-4">🛡️</div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight leading-none">
              Never Miss A <br />
              <span className="bg-gradient-to-r from-cyan-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">Priority Email</span> Again.
            </h1>
            <p className="text-slate-400 text-sm max-w-sm mx-auto">
              Get loud physical phone alarms instantly when key hiring managers, recruiters, or system offers land in your inbox.
            </p>
          </div>

          <div className="w-full bg-slate-900/60 border border-slate-800 rounded-3xl p-8 backdrop-blur-md shadow-2xl space-y-6">
            <h2 className="text-sm font-semibold tracking-wider text-slate-400 uppercase">Secure Account Access</h2>
            <div className="space-y-4">
              <button
                onClick={handleLoginRedirect}
                className="w-full flex items-center justify-center space-x-3 bg-white text-slate-900 hover:bg-slate-100 active:scale-[0.98] py-3.5 px-4 font-bold rounded-2xl transition duration-150 shadow-lg shadow-white/5"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span>Sign In with Gmail</span>
              </button>
            </div>
            <div className="border-t border-slate-800 pt-6 text-left space-y-3">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Security Guarantee</div>
              <ul className="text-xs text-slate-400 space-y-2 font-medium">
                <li className="flex items-center gap-2"><span className="text-cyan-400">✓</span> No Gmail passwords stored.</li>
                <li className="flex items-center gap-2"><span className="text-cyan-400">✓</span> Direct secure Google OAuth 2.0 standard.</li>
                <li className="flex items-center gap-2"><span className="text-cyan-400">✓</span> Least-privilege read-only mail access scopes.</li>
              </ul>
            </div>
          </div>
        </main>

        <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500 z-10">
          <p>PriorityMail Guardian • Google API Secure OAuth Framework</p>
        </footer>
      </div>
    );
  }

  // ═══ DASHBOARD ══════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-900">

      {/* Alarm Overlay */}
      {isAlarmActive && (
        <div className="fixed inset-0 bg-red-950/90 z-50 flex flex-col items-center justify-center p-6 backdrop-blur-md animate-pulse border-8 border-red-500">
          <div className="bg-slate-900 border-2 border-red-500 rounded-2xl p-8 max-w-md w-full shadow-2xl text-center space-y-6">
            <div className="w-20 h-20 bg-red-500/20 border-2 border-red-500 text-red-500 rounded-full flex items-center justify-center mx-auto text-4xl animate-bounce">🚨</div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-red-500 tracking-wider">PRIORITY MAIL ALARM</h2>
              <p className="text-slate-400 text-sm">A matching priority email was detected.</p>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-red-900/50 text-left space-y-2">
              <div className="text-xs text-red-400 font-semibold tracking-wider uppercase">Sender</div>
              <div className="text-sm font-semibold truncate text-white">{activeAlarmData?.sender}</div>
              <div className="text-xs text-red-400 font-semibold tracking-wider uppercase mt-2">Subject</div>
              <div className="text-sm font-medium text-slate-200 line-clamp-2">{activeAlarmData?.subject}</div>
            </div>
            <div className="flex gap-4">
              <button onClick={dismissAlarm} className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 active:scale-95 text-sm font-semibold rounded-xl border border-slate-700 transition duration-150">Dismiss</button>
              <button onClick={() => { window.open('https://mail.google.com', '_blank'); dismissAlarm(); }} className="flex-1 py-3 px-4 bg-gradient-to-r from-red-600 to-orange-600 hover:brightness-110 active:scale-95 text-white text-sm font-semibold rounded-xl transition duration-150 shadow-lg shadow-red-900/40">Open Gmail</button>
            </div>
          </div>
        </div>
      )}

      {/* Background glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🛡️</span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                PriorityMail <span className="bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">Guardian</span>
              </h1>
              <p className="text-xs text-slate-400 font-medium">Never miss a priority email again.</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right hidden md:block">
              <div className="text-xs font-bold text-white">{user?.name || 'Guardian User'}</div>
              <div className="text-[10px] text-slate-400">{user?.email}</div>
            </div>
            <button onClick={handleLogout} className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-xs font-semibold rounded-xl border border-slate-700 transition duration-150">Sign Out</button>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8 z-10">

        {/* Left Column */}
        <div className="lg:col-span-1 space-y-6">

          {/* System Monitor */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-cyan-500/5 to-transparent rounded-full" />
            <h2 className="text-sm font-semibold tracking-wider text-slate-400 uppercase mb-4">System Monitor</h2>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-extrabold text-white">{monitoring ? 'ACTIVE' : 'OFFLINE'}</div>
                <p className="text-xs text-slate-400 mt-1">{monitoring ? 'Scanning Gmail every 5 seconds...' : 'Background scanning paused'}</p>
              </div>
              <button
                onClick={handleToggleMonitoring}
                className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${monitoring ? 'bg-cyan-500' : 'bg-slate-700'}`}
              >
                <span className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${monitoring ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
            <div className="border-t border-slate-800/80 mt-6 pt-4 grid grid-cols-2 gap-3">
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-cyan-400">{rules.length}</div>
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Active Rules</div>
              </div>
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-red-400">{history.length}</div>
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Total Alerts</div>
              </div>
            </div>
            <div className="mt-4">
              <button onClick={triggerTestAlarm} className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 hover:text-white font-medium rounded-xl text-xs transition duration-150">🔊 Test Alarm</button>
            </div>
          </div>

          {/* Add Rule Form */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-sm font-semibold tracking-wider text-slate-400 uppercase mb-4">Add Priority Rule</h2>
            <form onSubmit={handleAddRule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Rule Name</label>
                <input type="text" value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="e.g. Google HR Contact" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 transition duration-150" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Trigger Condition</label>
                <select value={ruleType} onChange={(e) => setRuleType(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 transition duration-150">
                  <option value="sender">IF Sender Email =</option>
                  <option value="subject_contains">IF Subject Contains</option>
                  <option value="body_contains">IF Body Contains</option>
                  <option value="attachment_type">IF Attachment Ext =</option>
                  <option value="is_important">IF Marked Important</option>
                </select>
              </div>
              {ruleType !== 'is_important' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Trigger Value</label>
                  <input type="text" value={ruleValue} onChange={(e) => setRuleValue(e.target.value)} placeholder={ruleType === 'sender' ? 'hr@company.com' : ruleType === 'attachment_type' ? 'pdf' : 'Search Term'} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 transition duration-150" />
                </div>
              )}
              <button type="submit" className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:brightness-110 active:scale-98 font-semibold rounded-xl text-xs text-white transition duration-150 shadow-md shadow-cyan-950/20">+ Add Rule</button>
            </form>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Rules List */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold tracking-wider text-slate-400 uppercase">Active Rule Engine</h2>
              <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-300 rounded text-xs">{rules.length} Rules</span>
            </div>
            {rules.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">No rules configured yet. Add your first priority rule using the form.</div>
            ) : (
              <div className="space-y-3">
                {rules.map((rule) => (
                  <div key={rule._id} className={`flex items-center justify-between p-4 rounded-xl border transition duration-150 ${rule.isEnabled ? 'bg-slate-950/50 border-slate-800 hover:border-slate-700' : 'bg-slate-950/20 border-slate-900/50 opacity-60'}`}>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-sm text-white">{rule.name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${rule.type === 'sender' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : rule.type === 'is_important' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-violet-500/10 text-violet-400 border border-violet-500/20'}`}>{rule.type.toUpperCase()}</span>
                      </div>
                      {rule.type !== 'is_important' && <p className="text-xs text-slate-400 font-mono">{rule.value}</p>}
                    </div>
                    <div className="flex items-center space-x-3">
                      <input type="checkbox" checked={rule.isEnabled} onChange={() => toggleRule(rule._id)} className="cursor-pointer accent-cyan-500" />
                      <button onClick={() => handleDeleteRule(rule._id)} className="text-slate-500 hover:text-red-400 text-sm transition duration-150" title="Delete Rule">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alert History */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold tracking-wider text-slate-400 uppercase">Alarm History</h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mr-1.5 animate-ping" />
                Auto-refresh
              </span>
            </div>
            {history.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">No alerts triggered yet. The scanner is monitoring your inbox.</div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {history.map((alert) => (
                  <div key={alert._id} className="py-4 first:pt-0 last:pb-0 flex justify-between items-start">
                    <div className="space-y-1 flex-1 pr-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-sm text-slate-200">{alert.sender}</span>
                        <span className="text-[10px] text-slate-500">{timeAgo(alert.receivedAt || alert.createdAt)}</span>
                      </div>
                      <p className="text-xs text-slate-400 font-medium">{alert.subject}</p>
                      {alert.matchedRules && alert.matchedRules.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {alert.matchedRules.map((mr, idx) => (
                            <span key={idx} className="text-[10px] text-red-400 bg-red-950/20 border border-red-900/40 rounded px-1.5 py-0.5 font-mono">
                              {mr.type}: {mr.value}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={() => window.open('https://mail.google.com', '_blank')} className="text-xs py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition duration-150 shrink-0 border border-slate-700">Open Mail</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <p>PriorityMail Guardian • Secure OAuth Integration • No Gmail Password Stored</p>
      </footer>
    </div>
  );
}
