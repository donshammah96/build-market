"use client";

import { DollarSign, Download, ArrowUpRight, ArrowDownLeft, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function FinancePage() {
  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-end border-b border-zinc-100 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Financial Overview</h1>
          <p className="text-zinc-500 mt-1">Track earnings, invoices, and payouts.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="bg-white">
            <Download className="mr-2 h-4 w-4" /> Export Report
          </Button>
          <Button className="bg-zinc-900 text-white hover:bg-zinc-800">
            <Wallet className="mr-2 h-4 w-4" /> Withdraw Funds
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <FinanceCard title="Total Earnings" value="KSh 4,250,000" sub="All time" active />
        <FinanceCard title="Pending Payouts" value="KSh 150,000" sub="Available for withdrawal" />
        <FinanceCard title="Outstanding Invoices" value="KSh 85,000" sub="2 Invoices overdue" alert />
      </div>

      {/* Transactions Table */}
      <Card className="border border-zinc-200 shadow-sm bg-white">
        <CardHeader className="border-b border-zinc-100 py-4 px-6">
          <CardTitle className="text-base font-bold text-zinc-900">Recent Transactions</CardTitle>
        </CardHeader>
        <div className="p-0">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-50 text-zinc-500 font-medium">
              <tr>
                <th className="px-6 py-3">Transaction ID</th>
                <th className="px-6 py-3">Description</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              <TransactionRow 
                id="TXN-9923" 
                desc="Payment for Kitchen Reno (Milestone 1)" 
                date="Oct 24, 2024" 
                amount="+ KSh 450,000" 
                status="Completed" 
                type="in"
              />
              <TransactionRow 
                id="TXN-9922" 
                desc="Withdrawal to Equity Bank" 
                date="Oct 20, 2024" 
                amount="- KSh 200,000" 
                status="Processing" 
                type="out"
              />
              <TransactionRow 
                id="TXN-9921" 
                desc="Consultation Fee - Sarah J." 
                date="Oct 18, 2024" 
                amount="+ KSh 5,000" 
                status="Completed" 
                type="in"
              />
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function FinanceCard({ title, value, sub, active, alert }: any) {
  return (
    <Card className={`border shadow-sm ${active ? 'border-emerald-200 bg-emerald-50/30' : 'border-zinc-200 bg-white'}`}>
      <CardContent className="p-6">
        <p className="text-sm font-medium text-zinc-500 mb-1">{title}</p>
        <h3 className={`text-2xl font-bold ${alert ? 'text-amber-600' : 'text-zinc-900'}`}>{value}</h3>
        <p className="text-xs text-zinc-400 mt-1">{sub}</p>
      </CardContent>
    </Card>
  )
}

function TransactionRow({ id, desc, date, amount, status, type }: any) {
  return (
    <tr className="hover:bg-zinc-50/50 transition-colors">
      <td className="px-6 py-4 font-mono text-xs text-zinc-500">{id}</td>
      <td className="px-6 py-4 font-medium text-zinc-900">{desc}</td>
      <td className="px-6 py-4 text-zinc-500">{date}</td>
      <td className={`px-6 py-4 font-medium ${type === 'in' ? 'text-emerald-600' : 'text-zinc-900'}`}>
        {amount}
      </td>
      <td className="px-6 py-4">
        <Badge variant="outline" className={status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}>
          {status}
        </Badge>
      </td>
    </tr>
  )
}