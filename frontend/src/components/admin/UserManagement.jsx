import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import useAdminStore from '../../stores/adminStore';
import useAuthStore from '../../stores/authStore';

// Icons
const Icons = {
  Users: () => <span className="text-xl">👥</span>,
  Search: () => <span className="text-lg">🔍</span>,
  Filter: () => <span className="text-lg">🔽</span>,
  Edit: () => <span className="text-lg">✏️</span>,
  Delete: () => <span className="text-lg">🗑️</span>,
  Add: () => <span className="text-lg">➕</span>,
  Email: () => <span className="text-lg">📧</span>,
  Settings: () => <span className="text-lg">⚙️</span>,
  Activity: () => <span className="text-lg">⚡</span>,
  Calendar: () => <span className="text-lg">📅</span>,
  Shield: () => <span className="text-lg">🛡️</span>,
  Check: () => <span className="text-lg">✅</span>,
  X: () => <span className="text-lg">❌</span>
};

const UserManagement = () => {
  const {
    users,
    userGroups,
    isUsersLoading,
    usersError,
    fetchAllUsers,
    fetchUserGroups,
    inviteUser,
    createUserGroup
  } = useAdminStore();
  
  const { user: currentUser } = useAuthStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showUserDetails, setShowUserDetails] = useState(null);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage] = useState(20);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([
          fetchAllUsers(),
          fetchUserGroups()
        ]);
      } catch (error) {
        console.error('Error loading user management data:', error);
      }
    };

    loadData();
  }, []);

  // Filter and sort users
  const filteredUsers = users
    .filter(user => {
      const matchesSearch = user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           user.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = selectedRole === 'all' || user.role === selectedRole;
      const matchesStatus = selectedStatus === 'all' || user.status === selectedStatus;
      
      return matchesSearch && matchesRole && matchesStatus;
    })
    .sort((a, b) => {
      let aVal = a[sortBy] || '';
      let bVal = b[sortBy] || '';
      
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * usersPerPage,
    currentPage * usersPerPage
  );

  const handleSelectUser = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === paginatedUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(paginatedUsers.map(user => user.id));
    }
  };

  const getUserStatusBadge = (status) => {
    const variants = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      pending: 'bg-yellow-100 text-yellow-800',
      suspended: 'bg-red-100 text-red-800'
    };
    
    return (
      <Badge className={variants[status] || variants.inactive}>
        {status}
      </Badge>
    );
  };

  const getRoleBadge = (role) => {
    const variants = {
      super_admin: 'bg-purple-100 text-purple-800',
      admin: 'bg-blue-100 text-blue-800',
      user: 'bg-gray-100 text-gray-800',
      guest: 'bg-orange-100 text-orange-800'
    };
    
    return (
      <Badge className={variants[role] || variants.user}>
        {role.replace('_', ' ')}
      </Badge>
    );
  };

  const renderUserInviteModal = () => {
    const [inviteData, setInviteData] = useState({
      email: '',
      name: '',
      role: 'user',
      send_welcome_email: true,
      expires_in_hours: 72
    });
    const [isInviting, setIsInviting] = useState(false);

    const handleInvite = async (e) => {
      e.preventDefault();
      setIsInviting(true);
      
      try {
        const result = await inviteUser(inviteData);
        if (result.success) {
          setShowInviteModal(false);
          setInviteData({ email: '', name: '', role: 'user', send_welcome_email: true, expires_in_hours: 72 });
          // Refresh user list
          fetchAllUsers();
        }
      } catch (error) {
        console.error('Error inviting user:', error);
      } finally {
        setIsInviting(false);
      }
    };

    if (!showInviteModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-full max-w-md mx-4">
          <CardHeader>
            <CardTitle>Invite New User</CardTitle>
            <CardDescription>Send an invitation to join the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={inviteData.email}
                  onChange={(e) => setInviteData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="user@example.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={inviteData.name}
                  onChange={(e) => setInviteData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="User's full name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select
                  value={inviteData.role}
                  onChange={(e) => setInviteData(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  {currentUser?.role === 'super_admin' && (
                    <option value="super_admin">Super Admin</option>
                  )}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Expires In</label>
                <select
                  value={inviteData.expires_in_hours}
                  onChange={(e) => setInviteData(prev => ({ ...prev, expires_in_hours: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={24}>24 hours</option>
                  <option value={48}>48 hours</option>
                  <option value={72}>72 hours</option>
                  <option value={168}>1 week</option>
                </select>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="send_welcome_email"
                  checked={inviteData.send_welcome_email}
                  onChange={(e) => setInviteData(prev => ({ ...prev, send_welcome_email: e.target.checked }))}
                  className="mr-2"
                />
                <label htmlFor="send_welcome_email" className="text-sm">
                  Send welcome email
                </label>
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowInviteModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isInviting}>
                  {isInviting ? 'Inviting...' : 'Send Invitation'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderUserDetails = () => {
    if (!showUserDetails) return null;
    
    const user = users.find(u => u.id === showUserDetails);
    if (!user) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-full max-w-2xl mx-4 max-h-[80vh] overflow-auto">
          <CardHeader>
            <CardTitle>User Details</CardTitle>
            <CardDescription>Detailed information for {user.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Basic Information</h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium">Name:</span>
                    <p className="text-sm text-gray-600">{user.name || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Email:</span>
                    <p className="text-sm text-gray-600">{user.email}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Role:</span>
                    <div className="mt-1">{getRoleBadge(user.role)}</div>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Status:</span>
                    <div className="mt-1">{getUserStatusBadge(user.status)}</div>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Joined:</span>
                    <p className="text-sm text-gray-600">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Activity Info */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Activity</h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium">Last Login:</span>
                    <p className="text-sm text-gray-600">
                      {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Total Meetings:</span>
                    <p className="text-sm text-gray-600">{user.total_meetings || 0}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Meeting Hours:</span>
                    <p className="text-sm text-gray-600">
                      {Math.round((user.total_meeting_minutes || 0) / 60)} hours
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Engagement Score:</span>
                    <p className="text-sm text-gray-600">{user.engagement_score || 0}%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 pt-4 border-t">
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm">
                  <Icons.Email />
                  <span className="ml-1">Send Email</span>
                </Button>
                <Button variant="outline" size="sm">
                  <Icons.Settings />
                  <span className="ml-1">Edit User</span>
                </Button>
                <Button variant="outline" size="sm">
                  <Icons.Activity />
                  <span className="ml-1">View Activity</span>
                </Button>
                {user.status === 'active' ? (
                  <Button variant="destructive" size="sm">
                    <Icons.X />
                    <span className="ml-1">Suspend</span>
                  </Button>
                ) : (
                  <Button variant="default" size="sm">
                    <Icons.Check />
                    <span className="ml-1">Activate</span>
                  </Button>
                )}
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={() => setShowUserDetails(null)}>
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderBulkActions = () => {
    if (selectedUsers.length === 0) return null;

    return (
      <Card className="mb-4">
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                Export Selected
              </Button>
              <Button variant="outline" size="sm">
                Bulk Email
              </Button>
              <Button variant="outline" size="sm">
                Change Role
              </Button>
              <Button variant="destructive" size="sm">
                Suspend Selected
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isUsersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading users...</p>
        </div>
      </div>
    );
  }

  if (usersError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Icons.X />
          <p className="text-red-600 mt-2">Error loading users</p>
          <p className="text-sm text-gray-500">{usersError}</p>
          <Button onClick={fetchAllUsers} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500 mt-1">
            Manage users, roles, and permissions
          </p>
        </div>
        <Button onClick={() => setShowInviteModal(true)}>
          <Icons.Add />
          <span className="ml-1">Invite User</span>
        </Button>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Icons.Search />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-2 w-full border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            {/* Role Filter */}
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Roles</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
              <option value="guest">Guest</option>
            </select>
            
            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
            </select>
            
            {/* Sort */}
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field);
                setSortOrder(order);
              }}
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="email-asc">Email A-Z</option>
              <option value="email-desc">Email Z-A</option>
              <option value="created_at-desc">Newest First</option>
              <option value="created_at-asc">Oldest First</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {renderBulkActions()}

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="text-left p-4 w-8">
                    <input
                      type="checkbox"
                      checked={selectedUsers.length === paginatedUsers.length && paginatedUsers.length > 0}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="text-left p-4">User</th>
                  <th className="text-left p-4">Role</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-left p-4">Last Login</th>
                  <th className="text-left p-4">Activity</th>
                  <th className="text-left p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map(user => (
                  <tr key={user.id} className="border-b hover:bg-gray-50">
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => handleSelectUser(user.id)}
                      />
                    </td>
                    <td className="p-4">
                      <div>
                        <div className="font-medium">{user.name || 'Unnamed User'}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      {getRoleBadge(user.role)}
                    </td>
                    <td className="p-4">
                      {getUserStatusBadge(user.status)}
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        <div>{user.total_meetings || 0} meetings</div>
                        <div className="text-gray-500">
                          {Math.round((user.total_meeting_minutes || 0) / 60)}h total
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowUserDetails(user.id)}
                        >
                          View
                        </Button>
                        <Button variant="outline" size="sm">
                          <Icons.Edit />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {((currentPage - 1) * usersPerPage) + 1} to {Math.min(currentPage * usersPerPage, filteredUsers.length)} of {filteredUsers.length} users
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                >
                  Previous
                </Button>
                <span className="px-3 py-1 text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{users.length}</div>
            <div className="text-sm text-gray-500">Total Users</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {users.filter(u => u.status === 'active').length}
            </div>
            <div className="text-sm text-gray-500">Active Users</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {users.filter(u => u.status === 'pending').length}
            </div>
            <div className="text-sm text-gray-500">Pending Users</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {users.filter(u => u.role === 'admin' || u.role === 'super_admin').length}
            </div>
            <div className="text-sm text-gray-500">Administrators</div>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      {renderUserInviteModal()}
      {renderUserDetails()}
    </div>
  );
};

export default UserManagement;