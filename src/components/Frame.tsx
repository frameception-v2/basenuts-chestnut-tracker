"use client";

import { useEffect, useCallback, useState } from "react";
import sdk, {
  AddFrame,
  SignIn as SignInCore,
  type Context,
} from "@farcaster/frame-sdk";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "~/components/ui/card";

import { config } from "~/components/providers/WagmiProvider";
import { truncateAddress } from "~/lib/truncateAddress";
import { base, optimism } from "wagmi/chains";
import { useSession } from "next-auth/react";
import { createStore } from "mipd";
import { Label } from "~/components/ui/label";
import { PROJECT_TITLE, START_DATE, DAILY_ALLOWANCE } from "~/lib/constants";
import Image from 'next/image';

function UserStats({ context, receivedNuts, sentNuts, failedAttempts }: { 
  context: Context.FrameContext, 
  receivedNuts: number,
  sentNuts: number,
  failedAttempts: number 
}) {
  const totalPoints = receivedNuts;
  const dailyReset = new Date();
  dailyReset.setUTCHours(11, 0, 0, 0);
  if (dailyReset.getTime() < Date.now()) {
    dailyReset.setUTCDate(dailyReset.getUTCDate() + 1);
  }
  
  const timeUntilReset = dailyReset.getTime() - Date.now();
  const hoursLeft = Math.floor(timeUntilReset / (1000 * 60 * 60));
  const minutesLeft = Math.floor((timeUntilReset % (1000 * 60 * 60)) / (1000 * 60));

  const daysSinceStart = Math.floor((Date.now() - START_DATE.getTime()) / (1000 * 60 * 60 * 24));
  const remainingAllowance = DAILY_ALLOWANCE * daysSinceStart - sentNuts;

  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-amber-700 to-amber-900 text-amber-50">
      <div className="absolute right-2 top-2 animate-spin">🌰</div>
      <CardHeader>
        <div className="flex items-center gap-3">
          {context.user?.pfpUrl && (
            <Image 
              src={context.user.pfpUrl} 
              alt="Profile"
              width={48}
              height={48}
              className="rounded-full border-2 border-amber-200"
            />
          )}
          <div>
            <CardTitle>{context.user?.displayName || 'Anonymous Squirrel'}</CardTitle>
            <CardDescription>FID: {context.user?.fid}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-amber-800 rounded-lg text-center">
            <div className="text-xs text-amber-300">Total Points</div>
            <div className="text-2xl font-bold">{totalPoints}</div>
          </div>
          <div className="p-3 bg-amber-800 rounded-lg text-center">
            <div className="text-xs text-amber-300">Daily Left</div>
            <div className="text-2xl font-bold">{Math.max(remainingAllowance, 0)}</div>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>🥜 Received</span>
            <span>{receivedNuts}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>🥜 Sent</span>
            <span>{sentNuts}</span>
          </div>
          <div className="flex justify-between text-sm text-red-200">
            <span>Failed Attempts</span>
            <span>{failedAttempts}</span>
          </div>
        </div>

        <div className="text-xs text-center text-amber-300 mt-4">
          Next reset in {hoursLeft}h {minutesLeft}m
        </div>
      </CardContent>
    </Card>
  );
}

export default function Frame() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext>();
  const [viewMode, setViewMode] = useState<'stats' | 'share'>('stats');
  const [receivedNuts, setReceivedNuts] = useState(0);
  const [sentNuts, setSentNuts] = useState(0);
  const [failedAttempts, setFailedAttempts] = useState(0);

  // Simulate real-time updates
  useEffect(() => {
    if (!context?.user?.fid) return;
    
    const interval = setInterval(() => {
      // In a real implementation, replace with actual API calls
      const baseNuts = Math.floor(Math.random() * 50); // Remove random in real impl
      setReceivedNuts(prev => prev + (context.user ? baseNuts : 0));
      setSentNuts(prev => {
        const newSent = prev + (context.user ? Math.floor(Math.random() * 2) : 0);
        const daysSinceStart = Math.floor((Date.now() - START_DATE.getTime()) / (1000 * 60 * 60 * 24));
        const maxAllowed = DAILY_ALLOWANCE * daysSinceStart;
        
        if (newSent > maxAllowed) {
          setFailedAttempts(prev => prev + 1);
          return prev;
        }
        return newSent;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [context?.user, context?.user?.fid]);

  const [added, setAdded] = useState(false);

  const [addFrameResult, setAddFrameResult] = useState("");

  const addFrame = useCallback(async () => {
    try {
      await sdk.actions.addFrame();
    } catch (error) {
      if (error instanceof AddFrame.RejectedByUser) {
        setAddFrameResult(`Not added: ${error.message}`);
      }

      if (error instanceof AddFrame.InvalidDomainManifest) {
        setAddFrameResult(`Not added: ${error.message}`);
      }

      setAddFrameResult(`Error: ${error}`);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      const context = await sdk.context;
      if (!context) {
        return;
      }

      setContext(context);
      setAdded(context.client.added);

      // If frame isn't already added, prompt user to add it
      if (!context.client.added) {
        addFrame();
      }

      sdk.on("frameAdded", ({ notificationDetails }) => {
        setAdded(true);
      });

      sdk.on("frameAddRejected", ({ reason }) => {
        console.log("frameAddRejected", reason);
      });

      sdk.on("frameRemoved", () => {
        console.log("frameRemoved");
        setAdded(false);
      });

      sdk.on("notificationsEnabled", ({ notificationDetails }) => {
        console.log("notificationsEnabled", notificationDetails);
      });
      sdk.on("notificationsDisabled", () => {
        console.log("notificationsDisabled");
      });

      sdk.on("primaryButtonClicked", () => {
        console.log("primaryButtonClicked");
      });

      console.log("Calling ready");
      sdk.actions.ready({});

      // Set up a MIPD Store, and request Providers.
      const store = createStore();

      // Subscribe to the MIPD Store.
      store.subscribe((providerDetails) => {
        console.log("PROVIDER DETAILS", providerDetails);
        // => [EIP6963ProviderDetail, EIP6963ProviderDetail, ...]
      });
    };
    if (sdk && !isSDKLoaded) {
      console.log("Calling load");
      setIsSDKLoaded(true);
      load();
      return () => {
        sdk.removeAllListeners();
      };
    }
  }, [isSDKLoaded, addFrame]);

  if (!isSDKLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div
      style={{
        paddingTop: context?.client.safeAreaInsets?.top ?? 0,
        paddingBottom: context?.client.safeAreaInsets?.bottom ?? 0,
        paddingLeft: context?.client.safeAreaInsets?.left ?? 0,
        paddingRight: context?.client.safeAreaInsets?.right ?? 0,
      }}
    >
      <div className="w-[300px] mx-auto py-2 px-2">
        <h1 className="text-2xl font-bold text-center mb-4 text-gray-700 dark:text-gray-300">
          {PROJECT_TITLE}
        </h1>
        
        <div className="flex gap-2 mb-4">
          <button 
            onClick={() => setViewMode('stats')}
            className={`flex-1 p-2 rounded-lg ${viewMode === 'stats' ? 'bg-amber-600 text-white' : 'bg-amber-100'}`}
          >
            Nuts State
          </button>
          <button 
            onClick={() => setViewMode('share')}
            className={`flex-1 p-2 rounded-lg ${viewMode === 'share' ? 'bg-amber-600 text-white' : 'bg-amber-100'}`}
          >
            Share It
          </button>
        </div>

        {viewMode === 'stats' && context?.user && (
          <UserStats 
            context={context}
            receivedNuts={receivedNuts}
            sentNuts={sentNuts}
            failedAttempts={failedAttempts}
          />
        )}

        {viewMode === 'share' && (
          <Card className="bg-amber-50">
            <CardHeader>
              <CardTitle>Share Your 🥜 Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">Share your chestnut achievements with the community!</p>
              <div className="p-2 bg-amber-100 rounded-lg break-all text-xs">
                {typeof window !== 'undefined' && `${window.location.origin}?fid=${context?.user?.fid}`}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${window.location.origin}?fid=${context?.user?.fid}`
                  );
                }}
                className="w-full p-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
              >
                Copy Share Link
              </button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
