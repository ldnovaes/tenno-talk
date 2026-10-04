import {
  lazy,
  Suspense,
  type ComponentType,
  type LazyExoticComponent,
  type ReactNode,
} from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";

import { PageSkeleton } from "@/components/common/PageSkeleton";
import { RouteErrorBoundary } from "@/components/common/RouteErrorBoundary";
import { ChatLayout } from "@/layouts/ChatLayout";
// Eager: the first screen of every new visitor (no extra round trip before it paints).
import WelcomePage from "@/pages/WelcomePage";
import { SidePanel } from "@/layouts/SidePanel";

import { OverlayGate, RedirectIfAuthed, RequireAuth, RequireOnboarded } from "./guards";
import { useBackgroundLocation } from "./overlay";
import { NavigationHistory } from "./NavigationHistory";
import { paths } from "./paths";

const SignInPage = lazy(() => import("@/pages/SignInPage"));
const SignUpPage = lazy(() => import("@/pages/SignUpPage"));
const TermsPage = lazy(() => import("@/pages/TermsPage"));
const PrivacyPage = lazy(() => import("@/pages/PrivacyPage"));
const OnboardingPage = lazy(() => import("@/pages/OnboardingPage"));
const ConversationListPage = lazy(() => import("@/pages/ConversationListPage"));
const ChatsIndexPage = lazy(() => import("@/pages/ChatsIndexPage"));
const ConversationPage = lazy(() => import("@/pages/ConversationPage"));
const DiscoverPage = lazy(() => import("@/pages/DiscoverPage"));
const PostPage = lazy(() => import("@/pages/PostPage"));
const FeedPage = lazy(() => import("@/pages/FeedPage"));
const NotificationsPage = lazy(() => import("@/pages/NotificationsPage"));
const CreatePostPage = lazy(() => import("@/pages/CreatePostPage"));
const StoryViewerPage = lazy(() => import("@/pages/StoryViewerPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const EditProfilePage = lazy(() => import("@/pages/EditProfilePage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const AdminAiPage = lazy(() => import("@/pages/AdminAiPage"));
const AdminReportsPage = lazy(() => import("@/pages/AdminReportsPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));

function page(
  Component: ComponentType | LazyExoticComponent<ComponentType>,
  fallback: ReactNode = <PageSkeleton />,
) {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={fallback}>
        <Component />
      </Suspense>
    </RouteErrorBoundary>
  );
}

/** Route map (PLAN.md §8). Overlay routes render a second time above a background on md+. */
export function AppRoutes({ shell }: { shell: ReactNode }) {
  const location = useLocation();
  const background = useBackgroundLocation();

  return (
    <NavigationHistory>
      <Routes location={background ?? location}>
        <Route path="/terms" element={page(TermsPage)} />
        <Route path="/privacy" element={page(PrivacyPage)} />
        <Route element={<RedirectIfAuthed />}>
          <Route path="/welcome" element={page(WelcomePage)} />
          <Route path="/signin" element={page(SignInPage)} />
          <Route path="/signup" element={page(SignUpPage)} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route path="/onboarding" element={<Navigate to={paths.onboarding()} replace />} />
          <Route path="/onboarding/:step" element={page(OnboardingPage)} />
          <Route element={<RequireOnboarded />}>
            <Route element={shell}>
              <Route index element={<Navigate to={paths.chats()} replace />} />
              <Route path="chats" element={<ChatLayout list={page(ConversationListPage)} />}>
                <Route index element={page(ChatsIndexPage)} />
                <Route path=":conversationId" element={page(ConversationPage)} />
              </Route>
              <Route path="discover" element={page(DiscoverPage)} />
              <Route path="feed" element={page(FeedPage)} />
              <Route path="posts/:postId" element={page(PostPage)} />
              <Route path="notifications" element={page(NotificationsPage)} />
              <Route path="create" element={page(CreatePostPage)} />
              <Route path="u/:username" element={page(ProfilePage)} />
              <Route path="u/:username/edit" element={page(EditProfilePage)} />
              <Route path="settings" element={page(SettingsPage)} />
              <Route path="settings/:section" element={page(SettingsPage)} />
              <Route path="admin/ai" element={page(AdminAiPage)} />
              <Route path="admin/reports" element={page(AdminReportsPage)} />
            </Route>
            <Route path="stories/:userId" element={page(StoryViewerPage)} />
          </Route>
        </Route>
        <Route path="*" element={page(NotFoundPage)} />
      </Routes>

      {background && (
        <OverlayGate>
          <Routes>
            <Route
              path="/u/:username"
              element={<SidePanel title="Profile">{page(ProfilePage)}</SidePanel>}
            />
            <Route
              path="/u/:username/edit"
              element={<SidePanel title="Edit profile">{page(EditProfilePage)}</SidePanel>}
            />
            <Route
              path="/settings"
              element={<SidePanel title="Settings">{page(SettingsPage)}</SidePanel>}
            />
            <Route
              path="/settings/:section"
              element={<SidePanel title="Settings">{page(SettingsPage)}</SidePanel>}
            />
            <Route path="/posts/:postId" element={page(PostPage)} />
            <Route path="/create" element={page(CreatePostPage)} />
            <Route path="/stories/:userId" element={page(StoryViewerPage)} />
          </Routes>
        </OverlayGate>
      )}
    </NavigationHistory>
  );
}
