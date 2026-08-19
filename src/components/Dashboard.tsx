import React from 'react';
import { Chapter, ProjectState } from '../types';
import { 
  BookOpen, 
  CheckCircle, 
  FileText, 
  Hash, 
  TrendingUp, 
  AlertTriangle 
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid 
} from 'recharts';
import { deriveChapterProgress } from '../domain/chapterProgress';

interface DashboardProps {
  chapters: Chapter[];
  project?: ProjectState | null;
}

const stageColors = ['#94a3b8', '#3b82f6', '#6366f1', '#f59e0b', '#8b5cf6', '#10b981', '#0d9488', '#0891b2'];

export function Dashboard({ chapters, project }: DashboardProps) {

  const totalChapters = chapters.length;
  const progressResults = chapters.map(deriveChapterProgress);
  const wordCounts = progressResults.map(result => result.currentWordCount).filter((count): count is number => count !== undefined);

  const avgWordCount = wordCounts.length > 0 
    ? Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length) 
    : 0;
  const totalWordCount = wordCounts.reduce((a, b) => a + b, 0);

  // All screen-level progress comes from the same derived result.
  const flaggedChaptersCount = progressResults.filter(r => r.discrepancies.length > 0).length;
  const totalDiscrepancies = progressResults.reduce((acc, r) => acc + r.discrepancies.length, 0);
  const blockingCount = progressResults.reduce((count, result) => count + result.discrepancies.filter(discrepancy => discrepancy.severity === 'blocking').length, 0);
  const cleanupCount = totalDiscrepancies - blockingCount;

  // Compute status distributions
  const stageCounts = progressResults.reduce((acc, progress) => {
    const stage = progress.currentStage.label;
    acc[stage] = (acc[stage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(stageCounts).map(([name, value], index) => ({
    name,
    value,
    color: stageColors[index % stageColors.length],
    description: `Current derived stage: ${name}`,
  }));

  const totalProgressed = progressResults.filter(progress => progress.currentStage.key !== 'no-confirmed-history').length;
  const progressPercent = totalChapters > 0 ? Math.round((totalProgressed / totalChapters) * 100) : 0;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percent = totalChapters > 0 ? ((data.value / totalChapters) * 100).toFixed(1) : 0;
      return (
        <div className="bg-white p-3 border border-gray-150 rounded-xl shadow-md font-sans">
          <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }}></span>
            {data.name}
          </p>
          <p className="text-xs text-gray-500 mt-1">{data.description}</p>
          <p className="text-sm text-gray-700 mt-2">
            Count: <span className="font-bold text-gray-950">{data.value}</span> ({percent}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center pb-4 border-b border-gray-100">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Overview</h1>
          <p className="text-gray-500 text-sm mt-0.5">Track real-time compilation metrics and production workflows.</p>
        </div>
      </div>
      {project && <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">Project: <span className="font-semibold">{project.name}</span> • Generation {project.generationId} • Started {new Date(project.startedAt).toLocaleString()}</div>}

      {/* Discrepancy Banner */}
      {flaggedChaptersCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between text-amber-900">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold">Workflow and data checks</p>
              <p className="text-xs text-amber-700 mt-0.5">
                {blockingCount > 0 ? `${blockingCount} workflow conflict${blockingCount === 1 ? '' : 's'} need${blockingCount === 1 ? 's' : ''} resolution. ` : ''}{cleanupCount > 0 ? `${cleanupCount} imported metadata item${cleanupCount === 1 ? '' : 's'} need${cleanupCount === 1 ? 's' : ''} review. ` : ''}Open the checks below for details.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Chapters" 
          value={totalChapters} 
          icon={<BookOpen className="w-6 h-6 text-blue-600" />} 
          bgColor="bg-blue-50" 
        />
        <StatCard 
          title="Average Current Words"
          value={avgWordCount} 
          icon={<FileText className="w-6 h-6 text-rose-600" />} 
          bgColor="bg-rose-50" 
        />
        <StatCard 
          title="Current Volume Words"
          value={totalWordCount} 
          icon={<Hash className="w-6 h-6 text-cyan-600" />} 
          bgColor="bg-cyan-50" 
        />
        <StatCard
          title="Needs Attention"
          value={flaggedChaptersCount}
          icon={<AlertTriangle className="w-6 h-6 text-amber-600" />}
          bgColor="bg-amber-50"
        />
      </div>

      {/* Visual Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        {/* Progress Breakdown donut chart */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between lg:col-span-1">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              Current Stage Distribution
            </h3>
            <p className="text-xs text-gray-500 mt-1">One canonical derived stage per chapter.</p>
          </div>
          
          <div className="relative h-60 my-4 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Donut Center Display */}
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-extrabold text-gray-900">{totalChapters}</span>
              <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Chapters</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                Active Progress Rate
              </span>
              <span className="text-indigo-600">{progressPercent}% ({totalProgressed} Chapters)</span>
            </div>
          </div>
        </div>

        {/* Detailed Breakdown BarChart and Legends */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm lg:col-span-2 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900">Current Production Stages</h3>
            <p className="text-xs text-gray-500 mt-1">Relative frequency of each derived current stage.</p>
          </div>

          <div className="h-60 my-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: -20, bottom: 5 }}
                barSize={32}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} 
                />
                <YAxis 
                  allowDecimals={false} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} 
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-bar-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Interactive Legend Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-gray-50">
            {chartData.map((item) => {
              const itemPercent = totalChapters > 0 ? Math.round((item.value / totalChapters) * 100) : 0;
              return (
                <div key={item.name} className="flex flex-col space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                    <span className="truncate">{item.name}</span>
                  </div>
                  <div className="flex items-baseline space-x-1.5 pl-4">
                    <span className="text-lg font-bold text-gray-900">{item.value}</span>
                    <span className="text-xs text-gray-400 font-medium">({itemPercent}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, total, icon, bgColor }: { title: string, value: number, total?: number, icon: React.ReactNode, bgColor: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-150 p-6 flex items-center space-x-4">
      <div className={`p-4 rounded-full ${bgColor}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <div className="flex items-baseline space-x-2">
          <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
          {total !== undefined && (
            <span className="text-sm text-gray-500 font-medium">/ {total}</span>
          )}
        </div>
      </div>
    </div>
  );
}
