"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Gift, Search, Users, Star, Crown, Award, Medal,
  TrendingUp, Plus, CreditCard, Cake, UserPlus,
  ArrowDown, ArrowUp, History,
} from "lucide-react";
import {
  loyaltyMembers,
  loyaltyTransactions,
  getPointsValue,
} from "@/lib/pharmacy-demo-data";
import type { LoyaltyMember, LoyaltyTransaction } from "@/lib/pharmacy-demo-data";

const tierConfig: Record<LoyaltyMember["tier"], { label: string; color: string; icon: React.ReactNode; min: number }> = {
  bronze: { label: "Bronze", color: "bg-orange-100 text-orange-700", icon: <Medal className="h-3 w-3" />, min: 0 },
  silver: { label: "Silver", color: "bg-gray-200 text-gray-700", icon: <Award className="h-3 w-3" />, min: 1000 },
  gold: { label: "Gold", color: "bg-yellow-100 text-yellow-700", icon: <Star className="h-3 w-3" />, min: 3000 },
  platinum: { label: "Platinum", color: "bg-purple-100 text-purple-700", icon: <Crown className="h-3 w-3" />, min: 5000 },
};

const transactionTypeConfig: Record<LoyaltyTransaction["type"], { label: string; color: string }> = {
  earned: { label: "Earned", color: "text-emerald-600" },
  redeemed: { label: "Redeemed", color: "text-red-600" },
  birthday_bonus: { label: "Birthday", color: "text-pink-600" },
  referral_bonus: { label: "Referral", color: "text-blue-600" },
  expired: { label: "Expired", color: "text-gray-500" },
};

export default function LoyaltyPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [view, setView] = useState<"members" | "transactions">("members");

  const filteredMembers = loyaltyMembers.filter(
    (m) => m.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.phone.includes(searchQuery) ||
      m.referralCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalMembers = loyaltyMembers.length;
  const totalPointsIssued = loyaltyMembers.reduce((sum, m) => sum + m.totalPoints, 0);
  const totalRedeemed = loyaltyMembers.reduce((sum, m) => sum + m.redeemedPoints, 0);

  const memberTransactions = selectedMember
    ? loyaltyTransactions.filter((t) => t.memberId === selectedMember)
    : loyaltyTransactions;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Loyalty Program</h1>
          <p className="text-muted-foreground text-sm">Manage loyalty members, points, and rewards</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="mr-2 h-4 w-4" /> Add Member
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <p className="text-sm">Total Members</p>
            </div>
            <p className="text-2xl font-bold">{totalMembers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <p className="text-sm">Points Issued</p>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{totalPointsIssued.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Gift className="h-4 w-4" />
              <p className="text-sm">Points Redeemed</p>
            </div>
            <p className="text-2xl font-bold text-purple-600">{totalRedeemed.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CreditCard className="h-4 w-4" />
              <p className="text-sm">Discount Value</p>
            </div>
            <p className="text-2xl font-bold">{getPointsValue(totalRedeemed)} <span className="text-sm font-normal">MAD</span></p>
          </CardContent>
        </Card>
      </div>

      {/* Program Rules */}
      <Card className="mb-6">
        <CardContent className="pt-4 pb-4">
          <div className="grid gap-4 md:grid-cols-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">1 MAD = 1 Point</p>
                <p className="text-xs text-muted-foreground">Earn on every purchase</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center">
                <Gift className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">10 Points = 1 MAD</p>
                <p className="text-xs text-muted-foreground">Redeem for discounts</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-pink-100 dark:bg-pink-900/30 text-pink-600 flex items-center justify-center">
                <Cake className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">Birthday Bonus</p>
                <p className="text-xs text-muted-foreground">200 bonus points</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
                <UserPlus className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">Referral Bonus</p>
                <p className="text-xs text-muted-foreground">100 pts referrer + 50 pts friend</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Tabs */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => { setView("members"); setSelectedMember(null); }}
          className={`px-4 py-2 rounded-lg text-sm ${view === "members" ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}>
          <Users className="h-4 w-4 inline mr-1" /> Members
        </button>
        <button onClick={() => setView("transactions")}
          className={`px-4 py-2 rounded-lg text-sm ${view === "transactions" ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}>
          <History className="h-4 w-4 inline mr-1" /> Transactions
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, or referral code..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {view === "members" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredMembers.map((member) => {
            const tier = tierConfig[member.tier];
            return (
              <Card key={member.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{member.patientName}</h3>
                      <p className="text-xs text-muted-foreground">{member.phone}</p>
                    </div>
                    <Badge className={`${tier.color} border-0 gap-1`}>
                      {tier.icon} {tier.label}
                    </Badge>
                  </div>

                  {/* Loyalty Card Visual */}
                  <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-xl p-4 text-white mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <Gift className="h-5 w-5" />
                      <span className="text-xs opacity-80">Pharmacie Centrale</span>
                    </div>
                    <p className="text-2xl font-bold mb-1">{member.availablePoints.toLocaleString()} <span className="text-sm font-normal">pts</span></p>
                    <p className="text-xs opacity-80">= {getPointsValue(member.availablePoints)} MAD discount</p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs">{member.patientName}</span>
                      <span className="text-xs opacity-80">{member.referralCode}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div>
                      <p className="text-sm font-bold text-emerald-600">{member.totalPoints.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-purple-600">{member.redeemedPoints.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Redeemed</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold">{member.totalPurchases.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Purchases</p>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-muted-foreground mb-3">
                    <p>Joined: {new Date(member.joinedAt).toLocaleDateString()}</p>
                    <p>Birthday: {new Date(member.dateOfBirth).toLocaleDateString("en-US", { month: "long", day: "numeric" })}</p>
                    {member.referredBy && <p>Referred by: {member.referredBy}</p>}
                    {member.birthdayRewardClaimed && (
                      <Badge className="bg-pink-100 text-pink-700 border-0 text-xs">
                        <Cake className="h-3 w-3 mr-1" /> Birthday reward claimed ({member.birthdayRewardYear})
                      </Badge>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 text-xs"
                      onClick={() => { setSelectedMember(member.id); setView("transactions"); }}>
                      <History className="mr-1 h-3 w-3" /> History
                    </Button>
                    <Button size="sm" className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700">
                      <Gift className="mr-1 h-3 w-3" /> Redeem
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {view === "transactions" && (
        <Card>
          <CardContent className="pt-0">
            {selectedMember && (
              <div className="py-3 border-b flex items-center justify-between">
                <p className="text-sm font-medium">
                  Transactions for: {loyaltyMembers.find((m) => m.id === selectedMember)?.patientName}
                </p>
                <Button variant="ghost" size="sm" onClick={() => setSelectedMember(null)}>
                  Show All
                </Button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="py-3 px-2 font-medium">Date</th>
                    <th className="py-3 px-2 font-medium">Member</th>
                    <th className="py-3 px-2 font-medium">Type</th>
                    <th className="py-3 px-2 font-medium">Description</th>
                    <th className="py-3 px-2 font-medium text-right">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {memberTransactions.map((tx) => {
                    const config = transactionTypeConfig[tx.type];
                    const member = loyaltyMembers.find((m) => m.id === tx.memberId);
                    return (
                      <tr key={tx.id} className="border-b hover:bg-muted/50 text-sm">
                        <td className="py-3 px-2">{tx.date}</td>
                        <td className="py-3 px-2 font-medium">{member?.patientName}</td>
                        <td className="py-3 px-2">
                          <Badge variant="outline" className={`text-xs ${config.color}`}>
                            {config.label}
                          </Badge>
                        </td>
                        <td className="py-3 px-2 text-muted-foreground">{tx.description}</td>
                        <td className={`py-3 px-2 text-right font-bold ${tx.points > 0 ? "text-emerald-600" : "text-red-600"}`}>
                          <span className="flex items-center justify-end gap-1">
                            {tx.points > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                            {tx.points > 0 ? "+" : ""}{tx.points}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
