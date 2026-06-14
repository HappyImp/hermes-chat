export interface Employee {
  name: string;
  role: string;
  avatar: string;
  status: 'working' | 'standby' | 'off' | 'completed';
  currentTask: string;
  tasks: string[];
}

export interface EmployeeStatusData {
  employees: Employee[];
}

export function getStatusLabel(status: Employee['status']): string {
  switch (status) {
    case 'working':
      return '工作中';
    case 'standby':
      return '待命';
    case 'off':
      return '休息';
    case 'completed':
      return '已完成';
    default:
      return '未知';
  }
}

export function getStatusColor(status: Employee['status']): string {
  switch (status) {
    case 'working':
      return 'bg-success';
    case 'standby':
      return 'bg-yellow-500';
    case 'off':
      return 'bg-gray-500';
    case 'completed':
      return 'bg-blue-500';
    default:
      return 'bg-gray-500';
  }
}
