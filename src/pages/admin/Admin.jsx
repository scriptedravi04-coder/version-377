import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { toast } from 'sonner';

import AdminAnalytics from '../../components/admin/AdminAnalytics';
import AdminUsersTab from '../../components/admin/AdminUsersTab';
import WaitlistManager from '../../components/admin/WaitlistManager';
import KYCManager from '../../components/admin/KYCManager';
import CampaignReviewQueue from '../../components/admin/CampaignReviewQueue';
import AdminChatDashboard from '../../components/chat/AdminChatDashboard';
import EscrowDashboard from '../../components/admin/EscrowDashboard';
import AdminUgcManager from '../../components/admin/AdminUgcManager';
import AdminActivityLogsTab from '../../components/admin/AdminActivityLogsTab';
import BlogManager from '../../components/admin/BlogManager';
import WhatsNewManager from '../../components/admin/WhatsNewManager';
import PushNotificationsManager from '../../components/admin/PushNotificationsManager';
import AdminHelpdeskHub from '../../components/admin/AdminHelpdeskHub';
import SystemReports from '../../components/admin/SystemReports';
import PlatformTools from '../../components/admin/PlatformTools';
import AdminMoreMobile from '../../components/admin/AdminMoreMobile';
import AdminPitchLeads from '../../components/admin/AdminPitchLeads';
import AdminChallengeEntries from '../../components/admin/AdminChallengeEntries'; // v367: Diwali Challenge

export default function Admin() {
  const location = useLocation();
  const navigate = useNavigate();
  const query = new URLSearchParams(location.search);
  const tab = query.get('tab') || 'dashboard';
  const role = query.get('role');

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState(false); // v330: failed load is not "No users found"
  const [banBusy, setBanBusy] = useState(false); // v330: no double ban / unban
  const [activeEnforcementUser, setActiveEnforcementUser] = useState(null);
  
  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      setUsersError(false); // v330
      const { data } = await api.get('/admin/users');
      setUsers(data?.users || data || []);
    } catch (error) {
      setUsersError(true); // v330
      console.error("Failed to load users", error);
      toast.error("Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  };

  // The users list is heavy; load it when the Users tab is opened, not on every admin page (session 27).
  const [usersLoaded, setUsersLoaded] = useState(false);
  useEffect(() => {
    if (tab === 'users' && !usersLoaded) {
      setUsersLoaded(true);
      loadUsers();
    }
  }, [tab, usersLoaded]);

  const banUser = async (userId, isBanned) => {
    if (banBusy) return; // v330
    try {
      setBanBusy(true); // v330
      if (isBanned) {
        await api.post(`/admin/users/${userId}/unban`);
        toast.success("User unbanned successfully");
      } else {
        if (!window.confirm("Are you sure you want to ban this user?")) return;
        await api.post(`/admin/users/${userId}/ban`);
        toast.success("User banned successfully");
      }
      loadUsers();
    } catch (error) {
      console.error("Ban action failed", error);
      toast.error(error?.response?.data?.error || "Failed to update ban status");
    } finally {
      setBanBusy(false); // v330
    }
  };

  const renderTabContent = () => {
    switch (tab) {
      case 'dashboard':
        return <AdminAnalytics onNavigate={(t) => navigate(`/admin?tab=${t}`)} />;
      case 'users':
        return (
          <AdminUsersTab 
            users={users} 
            load={loadUsers} 
            activeEnforcementUser={activeEnforcementUser}
            setActiveEnforcementUser={setActiveEnforcementUser}
            ban={banUser}
            initialRole={role}
            loading={loadingUsers} /* v330 */
            loadError={usersError}
          />
        );
      case 'waitlist':
        return <WaitlistManager />;
      case 'verifications':
        return <KYCManager />;
      case 'campaigns':
        return <CampaignReviewQueue />;
      case 'pitches':
        return <AdminPitchLeads />;
      case 'challenge':
        return <AdminChallengeEntries />;
      case 'chat':
        return <AdminChatDashboard />;
      case 'escrow':
        return <EscrowDashboard />;
      case 'ugc-orders':
        return <AdminUgcManager />;
      case 'activity-logs':
        return <AdminActivityLogsTab />;
      case 'blog':
        return <BlogManager />;
      case 'whats-new':
        return <WhatsNewManager />;
      case 'push':
        return <PushNotificationsManager />;
      case 'helpdesk':
        return <AdminHelpdeskHub key="helpdesk" initial="tickets" />;
      case 'feedback':
        return <AdminHelpdeskHub key="feedback" initial="chatbot" />;
      case 'reports':
        return <SystemReports />;
      case 'settings':
        return <PlatformTools />;
      case 'more':
        return <AdminMoreMobile />;
      // Session 43 (Ravi): Search Intelligence removed (it showed made-up numbers).
      default:
        return <AdminAnalytics onNavigate={(t) => navigate(`/admin?tab=${t}`)} />;
    }
  };

  return (
    <div className="w-full h-full flex flex-col min-h-screen px-4 md:px-6 py-4 md:py-6">
      {renderTabContent()}
    </div>
  );
}
