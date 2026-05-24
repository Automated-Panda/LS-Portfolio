import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { CheckEmailClient } from "./check-email-client";

type Props = {
  searchParams: Promise<{ email?: string }>;
};

export default async function CheckEmailPage({ searchParams }: Props) {
  const { email } = await searchParams;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Check your email</CardTitle>
        <CardDescription>
          {email
            ? `We sent a confirmation link to ${email}. Click it to finish setting up your portfolio.`
            : "We sent you a confirmation link. Click it to finish setting up your portfolio."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CheckEmailClient email={email ?? null} />
      </CardContent>
    </Card>
  );
}
