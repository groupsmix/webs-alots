'use client';

import { useState, useEffect } from 'react';
import { Lightbulb, TrendingUp, Users, Calendar, DollarSign, Clock, CheckCircle, XCircle } from 'lucide-react';

interface Insight {
  id: string;
  type: 'opportunity' | 'risk' | 'trend' | 'recommendation';
  category: 'revenue' | 'customer' | 'operations' | 'marketing';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number;
  acted_upon: boolean;
  action_taken?: string;
  created_at: string;
  metadata?: any;
}

export function AIInsightsPanel({ businessId }: { businessId: string }) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'acted'>('pending');

  useEffect(() => {
    loadInsights();
  }, [businessId, filter]);

  async function loadInsights() {
    try {
      const params = new URLSearchParams({ business_id: businessId });
      if (filter === 'pending') params.append('pending_only', 'true');
      if (filter === 'acted') params.append('acted_only', 'true');

      const response = await fetch(`/api/ai/insights?${params}`);
      const data = await response.json();

      if (data.ok) {
        setInsights(data.insights);
      }
    } catch (error) {
      console.error('Failed to load insights:', error);
    } finally {
      setLoading(false);
    }
  }

  function getTypeIcon(type: Insight['type']) {
    switch (type) {
      case 'opportunity':
        return <TrendingUp className="h-5 w-5 text-green-500" />;
      case 'risk':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'trend':
        return <TrendingUp className="h-5 w-5 text-blue-500" />;
      case 'recommendation':
        return <Lightbulb className="h-5 w-5 text-yellow-500" />;
    }
  }

  function getCategoryIcon(category: Insight['category']) {
    switch (category) {
      case 'revenue':
        return <DollarSign className="h-4 w-4" />;
      case 'customer':
        return <Users className="h-4 w-4" />;
      case 'operations':
        return <Clock className="h-4 w-4" />;
      case 'marketing':
        return <Calendar className="h-4 w-4" />;
    }
  }

  function getImpactColor(impact: Insight['impact']) {
    switch (impact) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  }

  function getTypeColor(type: Insight['type']) {
    switch (type) {
      case 'opportunity':
        return 'bg-green-50 border-green-200';
      case 'risk':
        return 'bg-red-50 border-red-200';
      case 'trend':
        return 'bg-blue-50 border-blue-200';
      case 'recommendation':
        return 'bg-yellow-50 border-yellow-200';
    }
  }

  const pendingCount = insights.filter(i => !i.acted_upon).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold">AI Insights</h3>
          {pendingCount > 0 && (
            <span className="px-2 py-1 text-xs font-medium bg-blue-500 text-white rounded-full">
              {pendingCount} new
            </span>
          )}
        </div>

        {/* Filter */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-sm rounded ${
              filter === 'all'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1 text-sm rounded ${
              filter === 'pending'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setFilter('acted')}
            className={`px-3 py-1 text-sm rounded ${
              filter === 'acted'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Acted Upon
          </button>
        </div>
      </div>

      {/* Insights List */}
      <div className="space-y-3">
        {insights.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Lightbulb className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>No insights available</p>
          </div>
        ) : (
          insights.map(insight => (
            <div
              key={insight.id}
              className={`p-4 rounded-lg border ${getTypeColor(insight.type)} ${
                insight.acted_upon ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="flex-shrink-0 mt-0.5">{getTypeIcon(insight.type)}</div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-medium text-gray-900">{insight.title}</h4>
                        {insight.acted_upon && (
                          <CheckCircle className="h-4 w-4 text-green-500" title="Acted upon" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{insight.description}</p>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center gap-3 mt-3">
                    {/* Category */}
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      {getCategoryIcon(insight.category)}
                      <span className="capitalize">{insight.category}</span>
                    </div>

                    {/* Impact */}
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded border ${getImpactColor(
                        insight.impact
                      )}`}
                    >
                      {insight.impact.toUpperCase()} IMPACT
                    </span>

                    {/* Confidence */}
                    <span className="text-xs text-gray-600">
                      {Math.round(insight.confidence * 100)}% confidence
                    </span>

                    {/* Type */}
                    <span className="text-xs text-gray-600 capitalize">{insight.type}</span>
                  </div>

                  {/* Action Taken */}
                  {insight.acted_upon && insight.action_taken && (
                    <div className="mt-3 p-2 bg-white rounded border border-gray-200">
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">Action taken:</span> {insight.action_taken}
                      </p>
                    </div>
                  )}

                  {/* Timestamp */}
                  <p className="mt-2 text-xs text-gray-500">
                    {new Date(insight.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary Stats */}
      {insights.length > 0 && (
        <div className="grid grid-cols-4 gap-4 pt-4 border-t border-gray-200">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">
              {insights.filter(i => i.type === 'opportunity').length}
            </p>
            <p className="text-xs text-gray-600">Opportunities</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">
              {insights.filter(i => i.type === 'risk').length}
            </p>
            <p className="text-xs text-gray-600">Risks</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">
              {insights.filter(i => i.impact === 'high').length}
            </p>
            <p className="text-xs text-gray-600">High Impact</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">
              {insights.filter(i => i.acted_upon).length}
            </p>
            <p className="text-xs text-gray-600">Acted Upon</p>
          </div>
        </div>
      )}
    </div>
  );
}
