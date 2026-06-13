export interface Employee {
  name: string;
  role: string;
  avatar: string;
  status: 'working' | 'standby' | 'off';
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
  }
}
