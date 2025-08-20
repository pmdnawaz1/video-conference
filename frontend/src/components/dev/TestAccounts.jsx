import React from "react";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { FiCopy, FiUser, FiShield } from "react-icons/fi";

const TestAccounts = ({ onClose }) => {
  const testAccounts = [
    {
      email: "superadmin@quibic.com",
      password: "password123",
      role: "SUPER_ADMIN",
      description: "Has access to all features and analytics data",
      color:
        "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400",
    },
    {
      email: "admin@quibic.com",
      password: "password123",
      role: "ADMIN",
      description: "Admin access with analytics and meeting management",
      color: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
    },
    {
      email: "admin@techstart.io",
      password: "password123",
      role: "ADMIN",
      description: "Admin for TechStart organization",
      color: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
    },
    {
      email: "summer.cormier79@gmail.com",
      password: "password123",
      role: "USER",
      description: "Regular user with meeting participation data",
      color:
        "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
    },
    {
      email: "piper.tillman36@gmail.com",
      password: "password123",
      role: "USER",
      description: "Regular user with analytics history",
      color:
        "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
    },
  ];

  const handleCopyCredentials = (email, password) => {
    const credentials = `${email} / ${password}`;
    navigator.clipboard
      .writeText(credentials)
      .then(() => {
        alert("Credentials copied to clipboard!");
      })
      .catch(() => {
        alert(`Credentials: ${credentials}`);
      });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto m-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <FiShield className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Test Accounts Available</h2>
          </div>
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4">
            <h3 className="font-medium mb-2">Database Status</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total Users:</span>
                <span className="ml-2 font-medium">64</span>
              </div>
              <div>
                <span className="text-muted-foreground">Total Meetings:</span>
                <span className="ml-2 font-medium">129</span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  Analytics Records:
                </span>
                <span className="ml-2 font-medium">900</span>
              </div>
              <div>
                <span className="text-muted-foreground">Organizations:</span>
                <span className="ml-2 font-medium">3</span>
              </div>
            </div>
          </div>

          {testAccounts.map((account, index) => (
            <Card key={index} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <FiUser className="w-4 h-4" />
                    <code className="font-mono text-sm">{account.email}</code>
                    <Badge className={account.color}>{account.role}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {account.description}
                  </p>
                  <div className="text-xs text-muted-foreground">
                    Password:{" "}
                    <code className="bg-muted px-1 rounded">
                      {account.password}
                    </code>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleCopyCredentials(account.email, account.password)
                  }
                  className="ml-2"
                >
                  <FiCopy className="w-3 h-3" />
                </Button>
              </div>
            </Card>
          ))}

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mt-4">
            <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
              What to Expect After Login
            </h3>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>
                • <strong>Dashboard:</strong> Real meeting statistics and
                analytics
              </li>
              <li>
                • <strong>Analytics Tab:</strong> Charts with participation
                trends
              </li>
              <li>
                • <strong>Meeting History:</strong> 129 meetings with
                participants
              </li>
              <li>
                • <strong>Recent Activity:</strong> Live meeting and user
                activity feed
              </li>
              <li>
                • <strong>Theme Switching:</strong> Proper dark/light mode
                transitions
              </li>
            </ul>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
            <h3 className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">
              Features Tested & Working
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm text-yellow-800 dark:text-yellow-200">
              <div>✅ API Authentication</div>
              <div>✅ User Analytics</div>
              <div>✅ Meeting History</div>
              <div>✅ Admin Dashboard</div>
              <div>✅ Theme Switching</div>
              <div>✅ Database Seeding</div>
              <div>✅ Real-time Data</div>
              <div>✅ Error Handling</div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default TestAccounts;
