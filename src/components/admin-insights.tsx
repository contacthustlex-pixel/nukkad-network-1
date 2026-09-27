"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type WeekPoint = {
  label: string;
  redemptions: number;
  gross: number;
};

type CategoryPoint = {
  category: string;
  count: number;
};

export function AdminInsights({
  weekly,
  byCategory,
}: {
  weekly: WeekPoint[];
  byCategory: CategoryPoint[];
}) {
  return (
    <section className="rounded-2xl border border-brand-blue/10 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-bold text-brand-blue">Network insights</h2>
      <p className="text-sm text-brand-black/70">Last 8 weeks redemptions + category mix.</p>
      <div className="mt-6 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={weekly}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="redemptions" stroke="#0E3A66" strokeWidth={2} name="Redemptions" />
            <Line type="monotone" dataKey="gross" stroke="#FFC94D" strokeWidth={2} name="Gross ₹" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-8 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={byCategory}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#0E3A66" name="Redemptions" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
