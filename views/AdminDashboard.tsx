import React, { useState, useEffect } from 'react';
import { Report, ReportStatus } from '../types';
import { getReports, updateReportStatus } from '../services/storageService';
import { Modal } from '@/components/Modal';

export const AdminDashboard: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    const fetchReports = async () => {
      const data = await getReports();
      // Sort by timestamp descending
      setReports(data.sort((a, b) => b.timestamp - a.timestamp));
    };
    fetchReports();
  }, []);
  const [filter, setFilter] = useState<ReportStatus | 'ALL'>('ALL');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  const handleStatusUpdate = async (id: string, newStatus: ReportStatus) => {
    await updateReportStatus(id, newStatus);
    setReports(reports.map(r => r.id === id ? { ...r, status: newStatus } : r));
  };

  const filteredReports = filter === 'ALL'
    ? reports
    : reports.filter(r => r.status === filter);

  const getSeverityColor = (sev: string) => {
    switch (sev.toLowerCase()) {
      case 'high': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'medium': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      default: return 'text-green-400 bg-green-400/10 border-green-400/20';
    }
  };

  const getStatusColor = (status: ReportStatus) => {
    switch (status) {
      case ReportStatus.PENDING: return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case ReportStatus.IN_PROGRESS: return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case ReportStatus.COMPLETED: return 'text-green-400 bg-green-400/10 border-green-400/20';
      case ReportStatus.CANCELLED: return 'text-red-400 bg-red-400/10 border-red-400/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-24">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">City Admin Dashboard</h2>
          <p className="text-slate-400">Overview of reported road hazards and maintenance status.</p>
        </div>

        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-1 bg-slate-900 p-1.5 rounded-xl border border-slate-800 min-w-max">
            {([
              'ALL',
              ReportStatus.PENDING,
              ReportStatus.IN_PROGRESS,
              ReportStatus.COMPLETED,
              ReportStatus.CANCELLED
            ] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 sm:px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all whitespace-nowrap ${filter === s ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                  }`}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden shadow-xl backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80">
                <th className="px-4 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Evidence</th>
                <th className="px-4 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Analysis</th>
                <th className="px-4 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Location</th>
                <th className="px-4 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell">Reported</th>
                <th className="px-4 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredReports.map((report) => (
                <tr key={report.id} className="hover:bg-slate-800/50 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="h-16 w-20 rounded-lg overflow-hidden border border-slate-700 bg-slate-800 relative group-hover:border-slate-600 transition-colors">
                      <img src={report.imageUrl} alt="Pothole" className="h-full w-full object-cover" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase border ${getSeverityColor(report.severity)}`}>
                      {report.severity}
                    </span>
                    <div className="mt-2 text-sm text-slate-300 max-w-xs truncate" title={report.description}>
                      {report.description}
                    </div>
                    {report.isAutoDetected && (
                      <span className="inline-block mt-2 text-[10px] text-purple-400 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        AI Detected
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${report.location.latitude},${report.location.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1.5 text-sm font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                      View Map
                    </a>
                    <div className="text-xs text-slate-600 mt-1 font-mono">
                      {report.location.latitude.toFixed(4)}, {report.location.longitude.toFixed(4)}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="text-sm text-slate-400">
                      {new Date(report.timestamp).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-slate-600">
                      {new Date(report.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase border ${getStatusColor(report.status)}`}>
                      {report.status.replace('_', ' ')}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <select
                        value={report.status}
                        onChange={(e) => handleStatusUpdate(report.id, e.target.value as ReportStatus)}
                        className="bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 placeholder-slate-400"
                      >
                        <option value={ReportStatus.PENDING}>Pending</option>
                        <option value={ReportStatus.IN_PROGRESS}>In Progress</option>
                        <option value={ReportStatus.COMPLETED}>Completed</option>
                      </select>
                      <button
                        onClick={() => {
                          setSelectedReport(report);
                          setIsViewModalOpen(true);
                        }}
                        className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredReports.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-500">
                    <div className="flex flex-col items-center">
                      <svg className="w-12 h-12 mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <p>No reports found matching this filter.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Report Modal */}
      {selectedReport && (
        <Modal
          isOpen={isViewModalOpen}
          onClose={() => setIsViewModalOpen(false)}
          title="Report Details"
        >
          <div className="space-y-6">
            <div
              className="aspect-video w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800 relative cursor-zoom-in"
              onClick={() => setFullscreenImage(selectedReport.imageUrl)}
              title="Click to enlarge"
            >
              <img
                src={selectedReport.imageUrl}
                alt="Report Evidence"
                className="w-full h-full object-contain"
              />
              {selectedReport.isAutoDetected && (
                <div className="absolute top-4 right-4 bg-purple-500/90 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  AI Detected
                </div>
              )}
              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-md flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
                Tap to zoom
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                <div className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Status</div>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase border ${getStatusColor(selectedReport.status)}`}>
                  {selectedReport.status.replace('_', ' ')}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                <div className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Severity</div>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase border ${getSeverityColor(selectedReport.severity)}`}>
                  {selectedReport.severity}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-2">Description</h4>
                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-slate-400 text-sm leading-relaxed">
                  {selectedReport.description}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-2">Location</h4>
                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 flex items-center justify-between">
                  <div className="font-mono text-sm text-slate-400">
                    {selectedReport.location.latitude.toFixed(6)}, {selectedReport.location.longitude.toFixed(6)}
                  </div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${selectedReport.location.latitude},${selectedReport.location.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 hover:text-blue-300 hover:underline text-sm font-medium flex items-center gap-1.5"
                  >
                    Open in Maps
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs text-slate-500 pt-2 border-t border-slate-800">
                <div>
                  Report ID: <span className="font-mono text-slate-400">{selectedReport.id.slice(0, 8)}...</span>
                </div>
                <div className="text-right">
                  Reported: <span className="text-slate-400">{new Date(selectedReport.timestamp).toLocaleString()}</span>
                </div>
              </div>
            </div>
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