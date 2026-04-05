'use client';

import { useState, useEffect } from 'react';
import { Brain, TrendingUp, Target, Zap, Award, AlertCircle } from 'lucide-react';

interface LearningMetrics {
  total_outcomes: number;
  success_rate: number;
  patterns_detected: number;
  learnings_applied: number;
  improvements: {
    action_type: string;
    before_success_rate: number;
    after_success_rate: number;
    improvement_percent: number;
  }[];
  top_patterns: {
    pattern_type: string;
    pattern: string;
    success_rate: number;
    occurrences: number;
  }[];
  confidence_calibration: {
    predicted_range: string;
    actual_success_rate: number;
    sample_size: number;
  }[];
}

export function AILearningMetrics({ businessId }: { businessId: string }) {
  const [metrics, setMetrics] = useState<LearningMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<7 | 30 | 90>(30);

  useEffect(() => {
    loadMetrics();
  }, [businessId, timeRange]);

  async function loadMetrics() {
    try {
      const response = await fetch(
        `/api/ai/performance?business_id=${businessId}&metric=learning_metrics&days=${timeRange}`
      );
      const data = await response.json();

      if (data.ok && data.learning_metrics) {
        setMetrics(data.learning_metrics);
      }
    } catch (error) {
      console.error('Failed to load learning metrics:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-8 text-gray-500">
        <AlertCircle className="h-12 w-12 mx-auto mb-2 text-gray-300" />
        <p>No learning metrics available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold">Learning Progress</h3>
        </div>

        {/* Time Range Selector */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setTimeRange(7)}
            className={`px-3 py-1 text-sm rounded ${
              timeRange === 7
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            7 days
          </button>
          <button
            onClick={() => setTimeRange(30)}
            className={`px-3 py-1 text-sm rounded ${
              timeRange === 30
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            30 days
          </button>
          <button
            onClick={() => setTimeRange(90)}
            className={`px-3 py-1 text-sm rounded ${
              timeRange === 90
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            90 days
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-blue-500" />
            <p className="text-xs text-gray-600">Total Outcomes</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{metrics.total_outcomes}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Award className="h-4 w-4 text-green-500" />
            <p className="text-xs text-gray-600">Success Rate</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {Math.round(metrics.success_rate * 100)}%
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            <p className="text-xs text-gray-600">Patterns Detected</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{metrics.patterns_detected}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-purple-500" />
            <p className="text-xs text-gray-600">Learnings Applied</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{metrics.learnings_applied}</p>
        </div>
      </div>

      {/* Improvements */}
      {metrics.improvements.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            Performance Improvements
          </h4>
          <div className="space-y-4">
            {metrics.improvements.map((improvement, index) => (
              <div key={index} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900 capitalize">
                    {improvement.action_type.replace('_', ' ')}
                  </span>
                  <span className="text-sm font-semibold text-green-600">
                    +{improvement.improvement_percent.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-600">
                  <span>
                    Before: {Math.round(improvement.before_success_rate * 100)}%
                  </span>
                  <span>→</span>
                  <span>
                    After: {Math.round(improvement.after_success_rate * 100)}%
                  </span>
                </div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${improvement.after_success_rate * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Patterns */}
      {metrics.top_patterns.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            Top Success Patterns
          </h4>
          <div className="space-y-3">
            {metrics.top_patterns.map((pattern, index) => (
              <div
                key={index}
                className="p-3 bg-yellow-50 rounded-lg border border-yellow-200"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-yellow-900 uppercase mb-1">
                      {pattern.pattern_type.replace('_', ' ')}
                    </p>
                    <p className="text-sm text-gray-900">{pattern.pattern}</p>
                  </div>
                  <span className="text-sm font-semibold text-yellow-700">
                    {Math.round(pattern.success_rate * 100)}%
                  </span>
                </div>
                <p className="text-xs text-gray-600">{pattern.occurrences} occurrences</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confidence Calibration */}
      {metrics.confidence_calibration.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-500" />
            Confidence Calibration
          </h4>
          <div className="space-y-3">
            {metrics.confidence_calibration.map((calibration, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm text-gray-900">
                    Predicted: {calibration.predicted_range}
                  </p>
                  <p className="text-xs text-gray-600">
                    {calibration.sample_size} samples
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    {Math.round(calibration.actual_success_rate * 100)}%
                  </p>
                  <p className="text-xs text-gray-600">actual</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Learning Status */}
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
        <div className="flex items-start gap-3">
          <Brain className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900 mb-1">AI Learning Status</p>
            <p className="text-sm text-blue-800">
              {metrics.total_outcomes < 50
                ? 'Collecting initial data. Learning will improve with more actions.'
                : metrics.patterns_detected === 0
                ? 'Analyzing patterns. Check back soon for insights.'
                : metrics.learnings_applied === 0
                ? 'Patterns detected. AI will start applying learnings to improve performance.'
                : `AI is actively learning and improving. ${metrics.learnings_applied} learnings applied with ${metrics.improvements.length} measurable improvements.`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
