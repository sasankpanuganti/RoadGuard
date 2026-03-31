import React, { useState, useEffect } from 'react';
import { User, Report, ReportStatus } from '../types';
import { getReports, updateReportStatus } from '../services/storageService';
import { LiveDetector } from './LiveDetector';
import { ManualReporter } from './ManualReporter';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';

interface UserDashboardProps {
  user: User;
}

type Mode = 'DASHBOARD' | 'LIVE' | 'MANUAL';

export const UserDashboard: React.FC<UserDashboardProps> = ({ user }) => {
  const [mode, setMode] = useState<Mode>('DASHBOARD');
  const [viewingReport, setViewingReport] = useState<Report | null>(null);
  const [myReports, setMyReports] = useState<Report[]>([]);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  // Force re-render to update list when report is cancelled
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchReports = async () => {
      const allReports = await getReports();
      const filtered = allReports
        .filter(r => (r.userId === user.id || r.userId === 'anonymous') && r.status !== ReportStatus.CANCELLED)
        .sort((a, b) => b.timestamp - a.timestamp);
      setMyReports(filtered);
    };
    fetchReports();
  }, [user.id, refreshKey]);

  const handleCancelReport = async (reportId: string) => {
    try {
      await updateReportStatus(reportId, ReportStatus.CANCELLED);
      setViewingReport(null);
      setRefreshKey(prev => prev + 1);
    } catch (error: any) {
      console.error("Failed to cancel report:", error);
      alert(`Failed to cancel report: ${error.message || "Unknown error"}`);
    }
  };

  if (mode === 'LIVE') {
    return <LiveDetector user={user} onExit={() => setMode('DASHBOARD')} />;
  }

  if (mode === 'MANUAL') {
    return <ManualReporter user={user} onExit={() => setMode('DASHBOARD')} />;
  }

  const getStatusColor = (status: ReportStatus) => {
    switch (status) {
      case ReportStatus.PENDING: return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case ReportStatus.IN_PROGRESS: return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case ReportStatus.COMPLETED: return 'bg-green-500/10 text-green-400 border-green-500/20';
      case ReportStatus.CANCELLED: return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-slate-500/10 text-slate-400';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-24">
      <div className="mb-10">
        <h2 className="text-3xl font-bold text-white mb-2">Welcome, {user.name}</h2>
        <p className="text-slate-400">Ready to help maintain our roads? Select a mode below.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {/* Live Mode Card */}
        <div
          onClick={() => setMode('LIVE')}
          className="group relative overflow-hidden rounded-3xl p-1 cursor-pointer transition-all duration-300 hover:scale-[1.02]"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-purple-600 opacity-20 group-hover:opacity-100 transition-opacity duration-300 blur-xl"></div>
          <div className="relative bg-slate-900 border border-slate-800 rounded-[22px] p-8 h-full group-hover:bg-slate-900/90 group-hover:border-blue-500/50 transition-colors">
            <div className="h-14 w-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-500 group-hover:text-white transition-all text-blue-400">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Live Detection</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Mount your phone and drive. AI will automatically scan the road and detect potholes in real-time.
            </p>
          </div>
        </div>

        {/* Manual Mode Card */}
        <div
          onClick={() => setMode('MANUAL')}
          className="group relative overflow-hidden rounded-3xl p-1 cursor-pointer transition-all duration-300 hover:scale-[1.02]"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-pink-600 to-orange-600 opacity-0 group-hover:opacity-20 transition-opacity duration-300 blur-xl"></div>
          <div className="relative bg-slate-900 border border-slate-800 rounded-[22px] p-8 h-full group-hover:bg-slate-900/90 group-hover:border-pink-500/50 transition-colors">
            <div className="h-14 w-14 bg-pink-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-pink-500 group-hover:text-white transition-all text-pink-400">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Snap & Report</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Walking by a hazard? Take a quick photo to manually submit a pothole report to the city.
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-800 pt-8">
        <h3 className="text-xl font-bold text-white mb-6">Recent Reports</h3>
        <div className="space-y-4">
          {myReports.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/50 rounded-2xl border border-dashed border-slate-800">
              <p className="text-slate-500">You haven't submitted any reports yet.</p>
            </div>
          ) : (
            myReports.slice(0, 5).map(report => (
              <div
                key={report.id}
                onClick={() => setViewingReport(report)}
                className="bg-slate-900/50 hover:bg-slate-800 transition-colors p-4 rounded-xl border border-slate-800/50 flex items-center gap-4 group cursor-pointer"
              >
                <div className="h-16 w-16 rounded-lg overflow-hidden bg-slate-800 relative">
                  <img src={report.imageUrl} alt="Pothole" className="h-full w-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-slate-200 truncate group-hover:text-blue-400 transition-colors">
                      {report.isAutoDetected ? 'Auto-Detected Hazard' : 'Manual Report'}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wide uppercase border ${getStatusColor(report.status)}`}>
                      {report.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 truncate">{report.description}</p>
                  <p className="text-xs text-slate-600 mt-1 font-mono">{new Date(report.timestamp).toLocaleDateString()}</p>
                </div>
                <div className="text-slate-600 group-hover:text-slate-300">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Report Details Modal */}
      {viewingReport && (
        <Modal
          isOpen={!!viewingReport}
          onClose={() => setViewingReport(null)}
          title="Report Details"
        >
          <div className="space-y-6">
            <div
              className="rounded-xl overflow-hidden border border-slate-800 bg-black cursor-zoom-in"
              onClick={() => setFullscreenImage(viewingReport.imageUrl)}
              title="Click to enlarge"
            >
              <img src={viewingReport.imageUrl} alt="Report Evidence" className="w-full h-auto max-h-[400px] object-contain" />
              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-md flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
                Tap to zoom
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Status</p>
                <span className={`inline-block px-2 py-1 rounded text-xs font-bold uppercase border ${getStatusColor(viewingReport.status)}`}>
                  {viewingReport.status.replace('_', ' ')}
                </span>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Severity</p>
                <span className="text-slate-200 font-medium capitalize">{viewingReport.severity}</span>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Date</p>
                <span className="text-slate-200 text-sm">{new Date(viewingReport.timestamp).toLocaleDateString()}</span>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Time</p>
                <span className="text-slate-200 text-sm">{new Date(viewingReport.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2">Analysis Description</p>
              <p className="text-slate-300 text-sm leading-relaxed">{viewingReport.description}</p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2">Location</p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${viewingReport.location.latitude},${viewingReport.location.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                View on Google Maps
              </a>
            </div>

            {viewingReport.status === ReportStatus.PENDING && (
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <Button
                  variant="danger"
                  fullWidth
                  onClick={() => handleCancelReport(viewingReport.id)}
                >
                  Cancel Report
                </Button>
                <p className="text-center text-xs text-slate-500">
                  Cancelling hides the report but keeps it in the system.
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Fullscreen Image Viewer */}
      {fullscreenImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setFullscreenImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
            onClick={() => setFullscreenImage(null)}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={fullscreenImage}
            alt="Fullscreen view"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="absolute bottom-4 text-white/60 text-sm">Tap anywhere to close</p>
        </div>
      )}
    </div>
  );
};