"use client";

import {
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@clerk/nextjs";
import { useMutation } from "@tanstack/react-query";
import { UserFormSchema } from "@build/types";
import { toast } from "react-toastify";

const AddUser = () => {
  const form = useForm<z.infer<typeof UserFormSchema>>({
    resolver: zodResolver(UserFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      emailAddress: [],
      username: "",
      password: "",
    },
  });

  const { getToken } = useAuth();

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof UserFormSchema>) => {
      const token = await getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/users`, // bootstrap-only: client-side public service URL
        {
          method: "POST",
          body: JSON.stringify(data),
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (!res.ok) {
        throw new Error("Failed to create user!");
      }
    },
    onSuccess: () => {
      toast.success("User created successfully");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <SheetContent className="bg-(--admin-surface-card) border-l-(--admin-data-border)">
      <SheetHeader>
        <SheetTitle className="mb-4 text-(--admin-color-text-primary) font-semibold text-xl">
          Add User
        </SheetTitle>
        <SheetDescription asChild>
          <Form {...form}>
            <form
              className="space-y-8"
              onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
            >
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-(--admin-color-text-primary) font-medium">
                      First Name
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="bg-(--admin-surface-input) border-(--admin-data-border) focus:bg-(--admin-surface-input-focus) text-(--admin-color-text-primary) rounded-(--admin-radius-md) focus:border-(--admin-color-accent)"
                      />
                    </FormControl>
                    <FormDescription className="text-(--admin-color-text-muted)">
                      Enter user first name.
                    </FormDescription>
                    <FormMessage className="text-(--admin-color-danger)" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-(--admin-color-text-primary) font-medium">
                      Last Name
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="bg-(--admin-surface-input) border-(--admin-data-border) focus:bg-(--admin-surface-input-focus) text-(--admin-color-text-primary) rounded-(--admin-radius-md) focus:border-(--admin-color-accent)"
                      />
                    </FormControl>
                    <FormDescription className="text-(--admin-color-text-muted)">
                      Enter user last name.
                    </FormDescription>
                    <FormMessage className="text-(--admin-color-danger)" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-(--admin-color-text-primary) font-medium">
                      Username
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="bg-(--admin-surface-input) border-(--admin-data-border) focus:bg-(--admin-surface-input-focus) text-(--admin-color-text-primary) rounded-(--admin-radius-md) focus:border-(--admin-color-accent)"
                      />
                    </FormControl>
                    <FormDescription className="text-(--admin-color-text-muted)">
                      Enter username.
                    </FormDescription>
                    <FormMessage className="text-(--admin-color-danger)" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="emailAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-(--admin-color-text-primary) font-medium">
                      Email Addresses
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="email1@gmail.com, email2@gmail.com"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const emails = e.target.value
                            .split(",")
                            .map((email: string) => email.trim())
                            .filter((email: string) => email);
                          field.onChange(emails);
                        }}
                        className="bg-(--admin-surface-input) border-(--admin-data-border) focus:bg-(--admin-surface-input-focus) text-(--admin-color-text-primary) rounded-(--admin-radius-md) focus:border-(--admin-color-accent)"
                      />
                    </FormControl>
                    <FormDescription className="text-(--admin-color-text-muted)">
                      Only admin can see your email.
                    </FormDescription>
                    <FormMessage className="text-(--admin-color-danger)" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-(--admin-color-text-primary) font-medium">
                      Password
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        className="bg-(--admin-surface-input) border-(--admin-data-border) focus:bg-(--admin-surface-input-focus) text-(--admin-color-text-primary) rounded-(--admin-radius-md) focus:border-(--admin-color-accent)"
                      />
                    </FormControl>
                    <FormDescription className="text-(--admin-color-text-muted)">
                      Enter user password.
                    </FormDescription>
                    <FormMessage className="text-(--admin-color-danger)" />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="bg-(--admin-color-accent) hover:bg-(--admin-color-accent-hover) text-(--admin-color-accent-foreground) rounded-(--admin-radius-md) transition-colors shadow-(--admin-shadow-sm) disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mutation.isPending ? "Submitting..." : "Submit"}
              </Button>
            </form>
          </Form>
        </SheetDescription>
      </SheetHeader>
    </SheetContent>
  );
};

export default AddUser;
