import type { User } from '../types';

interface UserListProps {
  users: User[];
  selectedUserId: number | null;
  onSelectUser: (user: User) => void;
  onEditUser: (user: User) => void;
  onDeleteUser: (user: User) => void;
  onCreateUser: () => void;
}

function getRoleBadgeColor(role: string): string {
  switch (role) {
    case 'admin':
      return 'bg-purple-100 text-purple-800';
    case 'user':
      return 'bg-green-100 text-green-800';
    case 'prospect':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function UserList({
  users,
  selectedUserId,
  onSelectUser,
  onEditUser,
  onDeleteUser,
  onCreateUser,
}: UserListProps) {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-800">Users</h2>
        <button
          onClick={onCreateUser}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
        >
          + Add User
        </button>
      </div>
      <ul className="divide-y divide-gray-200">
        {users.map((user) => {
          const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email;
          return (
            <li
              key={user.id}
              className={`px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                selectedUserId === user.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
              }`}
              onClick={() => onSelectUser(user)}
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">{displayName}</p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                  <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded ${getRoleBadgeColor(user.role)}`}>
                    {user.role}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditUser(user);
                    }}
                    className="px-2 py-1 text-sm text-blue-600 hover:bg-blue-100 rounded"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteUser(user);
                    }}
                    className="px-2 py-1 text-sm text-red-600 hover:bg-red-100 rounded"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          );
        })}
        {users.length === 0 && (
          <li className="px-4 py-8 text-center text-gray-500">No users found</li>
        )}
      </ul>
    </div>
  );
}
