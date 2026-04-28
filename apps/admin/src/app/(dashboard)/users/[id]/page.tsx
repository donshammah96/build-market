import { getUserDetails } from "@/actions/admin";
import { getAdminPermissions } from "@/actions/admin/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { notFound } from "next/navigation";
import { Mail, Phone, Calendar, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { UserActionControls } from "../user-action-controls";

export default async function UserDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const response = await getUserDetails(id);

  if (!response.success || !response.data) return notFound();

  const user = response.data;
  const { granularRole } = await getAdminPermissions();
  const canManageUsers = ["SUPER_ADMIN"].includes(granularRole || "");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20">
          <AvatarImage src={user.avatar || ""} />
          <AvatarFallback>{user.firstName?.[0] || "U"}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {user.firstName} {user.lastName}
          </h1>
          <div className="flex flex-col gap-1 text-muted-foreground text-sm mt-1">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" /> {user.email}
            </div>
            {user.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" /> {user.phone}
              </div>
            )}
          </div>
        </div>
        <div className="ml-auto flex flex-col items-end gap-2">
          <span className="px-3 py-1 bg-secondary rounded-full text-sm capitalize">
            {user.role}
          </span>
          <UserActionControls
            canManageUsers={canManageUsers}
            mode="buttons"
            userId={user.id}
            currentRole={user.role}
            showInvite={true}
            showRoleActions={true}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium">User ID</span>
              <span className="text-sm text-muted-foreground break-all">
                {user.id}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium">Clerk ID</span>
              <span className="text-sm text-muted-foreground break-all">
                {user.clerkId}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium">Joined</span>
              <span className="text-sm text-muted-foreground">
                <Calendar className="h-3 w-3 inline mr-1" />
                {new Date(user.createdAt).toLocaleDateString()}
              </span>
            </div>

            {user.clientProfile && (
              <div className="pt-4">
                <h4 className="font-semibold mb-2">Client Details</h4>
                <p className="text-sm text-muted-foreground">
                  {user.clientProfile.city}, {user.clientProfile.county}
                </p>
              </div>
            )}

            {user.professionalProfile && (
              <div className="pt-4">
                <h4 className="font-semibold mb-2">Professional Profile</h4>
                <Link
                  href={`/professionals/${user.id}`}
                  className="text-blue-600 hover:underline text-sm"
                >
                  View Professional Profile (
                  {user.professionalProfile.companyName})
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" /> Recent Orders
            </h4>
            {user.orders.length > 0 ? (
              <ul className="space-y-2">
                {user.orders.map((order: (typeof user.orders)[number]) => (
                  <li
                    key={order.id}
                    className="text-sm flex justify-between p-2 bg-secondary/50 rounded"
                  >
                    <span>Order #{order.id.slice(0, 8)}</span>
                    <span className="font-medium">
                      ${Number(order.totalAmount).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No recent orders.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
