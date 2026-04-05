'use client';

import { useState, useEffect } from 'react';
import { Activity, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';

interface HealthScore {
  overall_score: number;
  category_scores: {
    revenue: number;
    customer_satisfaction: number;
    operational_efficiency: number;
    growth: number;
  };
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  trend: 'improving' | 'stable' | 'declining';
}

export function AIHealthScore({ businessId }: { businessId: string }) {
  const [healthScore, setHealthScore] = useState<HealthScore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHealthScore();
  }, [businessId]);

  async function loadHealthScore() {
    try {
      const response = await fetch(`/api/ai/performance?business_id=${businessId}&metric=health_score`);
      const data = await response.json();

      if (data.ok && data.health_score) {
        setHealthScore(data.health_score);
      }
    } catch (error) {
      console.error('Failed to load health score:', error);
    } finally {
      setLoading(false);
    }
  }

  function getScoreColor(score: number) {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    if (score >= 40) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  }

  function getScoreLabel(score: number) {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Attention';
  }

  function getTrendIcon(trend: HealthScore['trend']) {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-5 w-5 text-green-500" />;
      case 'declining':
        return <TrendingDown className="h-5 w-5 text-red-500" />;
      case 'stable':
        return <Minus className="h-5 w-5 text-gray-500" />;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!healthScore) {
    return (
      <div className="text-center py-8 text-gray-500">
        <AlertCircle className="h-12 w-12 mx-auto mb-2 text-gray-300" />
        <p>No health score data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-gray-600" />
            <h3 className="text-lg font-semibold">Business Health Score</h3>
          </div>
          <div className="flex items-center gap-2">
            {getTrendIcon(healthScore.trend)}
            <span className="text-sm text-gray-600 capitalize">{healthScore.trend}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div
            className={`flex items-center justify-center w-24 h-24 rounded-full text-3xl font-bold ${getScoreColor(
              healthScore.overall_score
            )}`}
          >
            {healthScore.overall_score}
          </div>
          <div>
            <p className="text-2xl font-semibold text-gray-900">
              {getScoreLabel(healthScore.overall_score)}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Your business is performing{' '}
              {healthScore.overall_score >= 80
                ? 'exceptionally well'
                : healthScore.overall_score >= 60
                ? 'well'
                : healthScore.overall_score >= 40
                ? 'adequately'
                : 'below expectations'}
            </p>
          </div>
        </div>
      </div>

      {/* Category Scores */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="text-sm font-medium text-gray-700 mb-4">Category Breakdown</h4>
        <div className="space-y-4">
          {Object.entries(healthScore.category_scores).map(([category, score]) => (
            <div key={category}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700 capitalize">
                  {category.replace('_', ' ')}
                </span>
                <span className={`text-sm font-semibold ${getScoreColor(score).split(' ')[0]}`}>
                  {score}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getScoreColor(score).split(' ')[1]}`}
                  style={{ width: `${score}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Strengths */}
      {healthScore.strengths.length > 0 && (
        <div className="bg-green-50 rounded-lg border border-green-200 p-6">
          <h4 className="text-sm font-medium text-green-900 mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Strengths
          </h4>
          <ul className="space-y-2">
            {healthScore.strengths.map((strength, index) => (
              <li key={index} className="text-sm text-green-800 flex items-start gap-2">
                <span className="text-green-600 mt-0.5">✓</span>
                <span>{strength}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Weaknesses */}
      {healthScore.weaknesses.length > 0 && (
        <div className="bg-orange-50 rounded-lg border border-orange-200 p-6">
          <h4 className="text-sm font-medium text-orange-900 mb-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Areas for Improvement
          </h4>
          <ul className="space-y-2">
            {healthScore.weaknesses.map((weakness, index) => (
              <li key={index} className="text-sm text-orange-800 flex items-start gap-2">
                <span className="text-orange-600 mt-0.5">!</span>
                <span>{weakness}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {healthScore.recommendations.length > 0 && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
          <h4 className="text-sm font-medium text-blue-900 mb-3">AI Recommendations</h4>
          <ul className="space-y-2">
            {healthScore.recommendations.map((recommendation, index) => (
              <li key={index} className="text-sm text-blue-800 flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">→</span>
                <span>{recommendation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
