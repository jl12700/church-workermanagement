import React, { useState, useEffect } from "react";
import SidebarLayout from "../layout/Sidebar";
import { supabase } from "../database/supabase";
import { 
  Users, 
  UserCheck, 
  UserX, 
  Calendar,
  Clock,
  TrendingUp,
  PieChart,
  BarChart3,
  Activity,
  Target,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  Filter,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    
    totalWorkers: 0,
    activeWorkers: 0,
    inactiveWorkers: 0,
    suspendedWorkers: 0,
    newWorkersThisMonth: 0,
    
    
    todayAttendance: 0,
    weeklyAttendance: 0,
    monthlyAttendance: 0,
    attendanceRate: 0,
    lateAttendance: 0,
    
    
    totalEvents: 0,
    todayEvents: 0,
    upcomingEvents: 0,
    completedEvents: 0,
    
    
    ministries: [],
    topMinistries: [],
    
    
    averageCheckInTime: '08:45',
    onTimeRate: 0,
    completionRate: 0,
    
    
    weeklyTrend: [],
    monthlyTrend: [],
    ministryDistribution: []
  });

  const [calendarEvents, setCalendarEvents] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [dateRange, setDateRange] = useState('week'); 
  const [ministryFilter, setMinistryFilter] = useState('all');
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch all dashboard data
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch workers statistics
      const { count: totalWorkers } = await supabase
        .from('workers')
        .select('*', { count: 'exact', head: true });

      const { count: activeWorkers } = await supabase
        .from('workers')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Active');

      const { count: suspendedWorkers } = await supabase
        .from('workers')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Suspended');

      const { count: inactiveWorkers } = await supabase
        .from('workers')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Inactive');

      // Calculate new workers this month
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const startOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
      const endOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-31`;
      
      const { count: newWorkersThisMonth } = await supabase
        .from('workers')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth);

      // Fetch events statistics
      const today = new Date().toISOString().split('T')[0];
      const { count: totalEvents } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true });

      const { count: todayEvents } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('event_date', today)
        .eq('status', 'approved');

      const { count: upcomingEvents } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .gt('event_date', today)
        .eq('status', 'approved');

      const { count: completedEvents } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .lt('event_date', today);

      // Fetch today's attendance
      const { data: todayAttendanceData } = await supabase
        .from('attendance_status_view')
        .select('*')
        .eq('event_date', today);

      const todayAttendance = todayAttendanceData?.length || 0;

      // Calculate attendance rates
      let presentCount = 0;
      let lateCount = 0;
      
      if (todayAttendanceData) {
        todayAttendanceData.forEach(record => {
          const checkInTime = new Date(record.check_in_time);
          const hours = checkInTime.getHours();
          const minutes = checkInTime.getMinutes();
          const totalMinutes = (hours * 60) + minutes;
          
          const absentThreshold = (9 * 60) + 15;
          const lateThreshold = 9 * 60;
          
          if (totalMinutes >= absentThreshold) {
            // Already counted as absent
          } else if (totalMinutes >= lateThreshold) {
            lateCount++;
          } else {
            presentCount++;
          }
        });
      }

      const attendanceRate = activeWorkers > 0 ? (todayAttendance / activeWorkers) * 100 : 0;
      const onTimeRate = todayAttendance > 0 ? (presentCount / todayAttendance) * 100 : 0;

      // Fetch weekly attendance 
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const oneWeekAgoStr = oneWeekAgo.toISOString().split('T')[0];

      const { data: weeklyAttendanceData } = await supabase
        .from('attendance_status_view')
        .select('event_date, check_in_time')
        .gte('event_date', oneWeekAgoStr)
        .lte('event_date', today);

      
      const weeklyTrend = processDailyTrend(weeklyAttendanceData, oneWeekAgo, new Date());

      
      const { data: workers } = await supabase
        .from('workers')
        .select('ministry, status');

      const ministryMap = {};
      workers?.forEach(worker => {
        if (!ministryMap[worker.ministry]) {
          ministryMap[worker.ministry] = {
            total: 0,
            active: 0,
            suspended: 0,
            inactive: 0
          };
        }
        ministryMap[worker.ministry].total++;
        if (worker.status === 'Active') ministryMap[worker.ministry].active++;
        if (worker.status === 'Suspended') ministryMap[worker.ministry].suspended++;
        if (worker.status === 'Inactive') ministryMap[worker.ministry].inactive++;
      });

      const ministries = Object.keys(ministryMap);
      const topMinistries = Object.entries(ministryMap)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      const ministryDistribution = Object.entries(ministryMap)
        .map(([name, data]) => ({
          name,
          value: data.total
        }))
        .sort((a, b) => b.value - a.value);

      
      const currentDate = new Date();
      const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      const { data: monthEvents } = await supabase
        .from('events')
        .select('*')
        .gte('event_date', firstDayOfMonth.toISOString().split('T')[0])
        .lte('event_date', lastDayOfMonth.toISOString().split('T')[0])
        .eq('status', 'approved')
        .order('event_date', { ascending: true });

      const formattedEvents = (monthEvents || []).map(event => ({
        id: event.id,
        title: event.title,
        date: event.event_date,
        type: event.type,
        startTime: event.start_time,
        endTime: event.end_time,
        location: event.place || event.location,
        status: event.status
      }));

      
      const { data: recentActivitiesData } = await supabase
        .from('attendance_status_view')
        .select('*')
        .order('check_in_time', { ascending: false })
        .limit(10);

      const formattedActivities = (recentActivitiesData || []).map(activity => {
        const status = getAttendanceStatus(activity.check_in_time);
        return {
          id: activity.id,
          workerName: activity.worker_name,
          ministry: activity.ministry,
          eventTitle: activity.event_title,
          checkInTime: activity.check_in_time,
          status: status.status,
          statusText: status.text,
          time: new Date(activity.check_in_time).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })
        };
      });

      
      const startOfMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const startOfMonthStr = startOfMonthDate.toISOString().split('T')[0];
      
      const { count: monthlyAttendance } = await supabase
        .from('attendance_status_view')
        .select('*', { count: 'exact', head: true })
        .gte('event_date', startOfMonthStr)
        .lte('event_date', today);

      
      const startOfWeekDate = new Date();
      startOfWeekDate.setDate(startOfWeekDate.getDate() - 7);
      const startOfWeekStr = startOfWeekDate.toISOString().split('T')[0];
      
      const { count: weeklyAttendance } = await supabase
        .from('attendance_status_view')
        .select('*', { count: 'exact', head: true })
        .gte('event_date', startOfWeekStr)
        .lte('event_date', today);

      
      setStats({
        totalWorkers: totalWorkers || 0,
        activeWorkers: activeWorkers || 0,
        inactiveWorkers: inactiveWorkers || 0,
        suspendedWorkers: suspendedWorkers || 0,
        newWorkersThisMonth: newWorkersThisMonth || 0,
        
        todayAttendance: todayAttendance || 0,
        weeklyAttendance: weeklyAttendance || 0,
        monthlyAttendance: monthlyAttendance || 0,
        attendanceRate: parseFloat(attendanceRate.toFixed(1)),
        lateAttendance: lateCount || 0,
        
        totalEvents: totalEvents || 0,
        todayEvents: todayEvents || 0,
        upcomingEvents: upcomingEvents || 0,
        completedEvents: completedEvents || 0,
        
        ministries: ministries,
        topMinistries: topMinistries,
        
        averageCheckInTime: calculateAverageCheckInTime(todayAttendanceData),
        onTimeRate: parseFloat(onTimeRate.toFixed(1)),
        completionRate: completedEvents > 0 ? parseFloat(((completedEvents / totalEvents) * 100).toFixed(1)) : 0,
        
        weeklyTrend: weeklyTrend,
        monthlyTrend: [], 
        ministryDistribution: ministryDistribution
      });

      setCalendarEvents(formattedEvents);
      setRecentActivities(formattedActivities);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      alert('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const processDailyTrend = (attendanceData, startDate, endDate) => {
    const trendMap = {};
    const currentDate = new Date(startDate);
    
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      trendMap[dateStr] = {
        date: dateStr,
        formattedDate: currentDate.toLocaleDateString('en-US', { weekday: 'short' }),
        attendance: 0,
        present: 0,
        late: 0,
        absent: 0
      };
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    
    attendanceData?.forEach(record => {
      const dateStr = record.event_date;
      if (trendMap[dateStr]) {
        trendMap[dateStr].attendance++;
        
        const checkInTime = new Date(record.check_in_time);
        const hours = checkInTime.getHours();
        const minutes = checkInTime.getMinutes();
        const totalMinutes = (hours * 60) + minutes;
        
        const absentThreshold = (9 * 60) + 15;
        const lateThreshold = 9 * 60;
        
        if (totalMinutes >= absentThreshold) {
          trendMap[dateStr].absent++;
        } else if (totalMinutes >= lateThreshold) {
          trendMap[dateStr].late++;
        } else {
          trendMap[dateStr].present++;
        }
      }
    });
    
    return Object.values(trendMap);
  };

  
  const calculateAverageCheckInTime = (attendanceData) => {
    if (!attendanceData || attendanceData.length === 0) return 'N/A';
    
    let totalMinutes = 0;
    let count = 0;
    
    attendanceData.forEach(record => {
      if (record.check_in_time) {
        const checkInTime = new Date(record.check_in_time);
        const hours = checkInTime.getHours();
        const minutes = checkInTime.getMinutes();
        totalMinutes += (hours * 60) + minutes;
        count++;
      }
    });
    
    if (count === 0) return 'N/A';
    
    const avgMinutes = Math.round(totalMinutes / count);
    const hours = Math.floor(avgMinutes / 60);
    const minutes = avgMinutes % 60;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  
  const getAttendanceStatus = (checkInTime) => {
    if (!checkInTime) return { status: 'absent', text: 'Absent' };
    
    const time = new Date(checkInTime);
    const hours = time.getHours();
    const minutes = time.getMinutes();
    const totalMinutes = (hours * 60) + minutes;
    
    const absentThreshold = (9 * 60) + 15;
    const lateThreshold = 9 * 60;
    
    if (totalMinutes >= absentThreshold) {
      return { status: 'absent', text: 'Absent' };
    }
    
    if (totalMinutes >= lateThreshold && totalMinutes < absentThreshold) {
      return { status: 'late', text: 'Late' };
    }
    
    return { status: 'present', text: 'Present' };
  };

  
  useEffect(() => {
    fetchDashboardData();
    
    
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, 300000);
    
    return () => clearInterval(interval);
  }, [refreshKey]);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  if (loading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dashboard data...</p>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  
  const PIE_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];
  const STATUS_COLORS = {
    active: '#10B981',
    inactive: '#6B7280',
    suspended: '#EF4444',
    present: '#10B981',
    late: '#F59E0B',
    absent: '#EF4444'
  };

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-gray-50 p-4 md:p-6">
        
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-2">
                Monitor worker activities, attendance, and performance metrics
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="week">Last 7 Days</option>
                <option value="month">This Month</option>
                <option value="quarter">This Quarter</option>
                <option value="year">This Year</option>
              </select>
              <button
                onClick={handleRefresh}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Total</span>
            </div>
            <h3 className="text-3xl font-bold text-gray-900">{stats.totalWorkers}</h3>
            <p className="text-gray-600 mt-2">Active Workers</p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                <span className="text-green-600 font-medium">{stats.activeWorkers} Active</span>
                {' • '}
                <span className="text-gray-500">{stats.suspendedWorkers} Suspended</span>
              </span>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
          </div>

          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <UserCheck className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Today</span>
            </div>
            <h3 className="text-3xl font-bold text-gray-900">{stats.attendanceRate}%</h3>
            <p className="text-gray-600 mt-2">Attendance Rate</p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                {stats.todayAttendance} of {stats.activeWorkers} workers
              </span>
              <div className={`p-1 rounded-full ${stats.attendanceRate >= 70 ? 'bg-green-100' : 'bg-red-100'}`}>
                <div 
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    stats.attendanceRate >= 70 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {stats.attendanceRate >= 70 ? '✓' : '!'}
                </div>
              </div>
            </div>
          </div>

          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Today</span>
            </div>
            <h3 className="text-3xl font-bold text-gray-900">{stats.lateAttendance}</h3>
            <p className="text-gray-600 mt-2">Late Arrivals</p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                {stats.onTimeRate}% on-time rate
              </span>
              <AlertCircle className="w-5 h-5 text-yellow-500" />
            </div>
          </div>

          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Calendar className="w-6 h-6 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Total</span>
            </div>
            <h3 className="text-3xl font-bold text-gray-900">{stats.totalEvents}</h3>
            <p className="text-gray-600 mt-2">Events</p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                <span className="text-blue-600">{stats.upcomingEvents} Upcoming</span>
                {' • '}
                <span className="text-gray-500">{stats.completedEvents} Completed</span>
              </span>
              <Activity className="w-5 h-5 text-purple-500" />
            </div>
          </div>
        </div>

        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          
<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
  <div className="flex items-center justify-between mb-6">
    <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
      <PieChart className="w-5 h-5" />
      Worker Status Distribution
    </h2>
    <Filter className="w-5 h-5 text-gray-400" />
  </div>
  
  <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6">
    
    <div className="flex-1 h-64">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart>
          <Pie
            data={[
              { name: 'Active', value: stats.activeWorkers },
              { name: 'Suspended', value: stats.suspendedWorkers },
              { name: 'Inactive', value: stats.inactiveWorkers }
            ]}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={1}
            minAngle={3}
            dataKey="value"
            label={false} 
          >
            <Cell fill={STATUS_COLORS.active} />
            <Cell fill={STATUS_COLORS.suspended} />
            <Cell fill={STATUS_COLORS.inactive} />
          </Pie>
          <Tooltip 
            formatter={(value, name) => {
              const total = stats.activeWorkers + stats.suspendedWorkers + stats.inactiveWorkers;
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return [`${value} workers (${percentage}%)`, name];
            }}
          />
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
    
    
    <div className="flex-1 space-y-4">
      <div className="space-y-3">
        
        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="font-medium text-gray-900">Active</span>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-gray-900">{stats.activeWorkers}</p>
            <p className="text-sm text-gray-600">
              {stats.totalWorkers > 0 
                ? `${((stats.activeWorkers / stats.totalWorkers) * 100).toFixed(1)}%`
                : '0%'}
            </p>
          </div>
        </div>
        
        
        <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="font-medium text-gray-900">Suspended</span>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-gray-900">{stats.suspendedWorkers}</p>
            <p className="text-sm text-gray-600">
              {stats.totalWorkers > 0 
                ? `${((stats.suspendedWorkers / stats.totalWorkers) * 100).toFixed(1)}%`
                : '0%'}
            </p>
          </div>
        </div>
        
        
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-gray-400"></div>
            <span className="font-medium text-gray-900">Inactive</span>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-gray-900">{stats.inactiveWorkers}</p>
            <p className="text-sm text-gray-600">
              {stats.totalWorkers > 0 
                ? `${((stats.inactiveWorkers / stats.totalWorkers) * 100).toFixed(1)}%`
                : '0%'}
            </p>
          </div>
        </div>
      </div>
      
      {/* Summary */}
      <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-blue-700">Total Workers</span>
          <span className="text-lg font-bold text-blue-700">{stats.totalWorkers}</span>
        </div>
      </div>
    </div>
  </div>
</div>

          {/* Weekly Attendance Trend Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Weekly Attendance Trend
              </h2>
              <select
                value={ministryFilter}
                onChange={(e) => setMinistryFilter(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1 bg-white"
              >
                <option value="all">All Ministries</option>
                {stats.ministries.map((ministry, index) => (
                  <option key={index} value={ministry}>{ministry}</option>
                ))}
              </select>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.weeklyTrend}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="formattedDate" 
                    stroke="#666" 
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="#666" 
                    fontSize={12}
                  />
                  <Tooltip />
                  <Legend />
                  <Bar 
                    dataKey="present" 
                    name="Present" 
                    fill="#10B981" 
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar 
                    dataKey="late" 
                    name="Late" 
                    fill="#F59E0B" 
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar 
                    dataKey="absent" 
                    name="Absent" 
                    fill="#EF4444" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
              <span>Avg Daily Attendance: {Math.round(stats.weeklyTrend.reduce((sum, day) => sum + day.attendance, 0) / stats.weeklyTrend.length) || 0}</span>
              <span>Peak: {Math.max(...stats.weeklyTrend.map(day => day.attendance)) || 0}</span>
            </div>
          </div>
        </div>

        {/* Calendar and Recent Activities */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Monthly Calendar */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Monthly Calendar
              </h2>
              <span className="text-sm text-gray-500">
                {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
            </div>
            <div className="grid grid-cols-7 gap-2 mb-4">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
              {calendarEvents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No events scheduled this month</p>
                </div>
              ) : (
                calendarEvents.map((event) => {
                  const eventDate = new Date(event.date);
                  const today = new Date();
                  const isToday = eventDate.toDateString() === today.toDateString();
                  const isPast = eventDate < today;
                  
                  return (
                    <div
                      key={event.id}
                      className={`border rounded-lg p-4 transition-all ${
                        isToday
                          ? 'border-blue-500 bg-blue-50'
                          : isPast
                          ? 'border-gray-200 bg-gray-50'
                          : 'border-green-200 bg-green-50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{event.title}</h3>
                          <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
                            <span>{eventDate.toLocaleDateString('en-US', { 
                              weekday: 'short', 
                              month: 'short', 
                              day: 'numeric' 
                            })}</span>
                            <span>•</span>
                            <span>{event.startTime} - {event.endTime}</span>
                          </div>
                          {event.location && (
                            <p className="text-sm text-gray-500 mt-1">📍 {event.location}</p>
                          )}
                        </div>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          event.type === 'sunday_service' ? 'bg-purple-100 text-purple-800' :
                          event.type === 'training' ? 'bg-blue-100 text-blue-800' :
                          event.type === 'meeting' ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {event.type?.replace('_', ' ') || 'Event'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Recent Activities */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Recent Activities
              </h2>
              <span className="text-sm text-gray-500">
                Last 10 check-ins
              </span>
            </div>
            <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
              {recentActivities.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No recent activities</p>
                </div>
              ) : (
                recentActivities.map((activity) => (
                  <div key={activity.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            activity.status === 'present' ? 'bg-green-100 text-green-600' :
                            activity.status === 'late' ? 'bg-yellow-100 text-yellow-600' :
                            'bg-red-100 text-red-600'
                          }`}>
                            {activity.status === 'present' ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : activity.status === 'late' ? (
                              <Clock className="w-4 h-4" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">{activity.workerName}</h4>
                            <p className="text-sm text-gray-600">{activity.ministry}</p>
                          </div>
                        </div>
                        <p className="text-sm text-gray-500 mt-2 ml-11">
                          {activity.eventTitle} • {activity.time}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ml-2 ${
                        activity.status === 'present' ? 'bg-green-100 text-green-800' :
                        activity.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {activity.statusText}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Ministries</h3>
            <div className="space-y-4">
              {stats.topMinistries.map((ministry, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                      <span className="text-sm font-bold text-blue-600">{index + 1}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{ministry.name}</p>
                      <p className="text-sm text-gray-500">
                        {ministry.active} active workers
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{ministry.total}</p>
                    <p className="text-xs text-gray-500">total</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Stats</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">New Workers This Month</span>
                <span className="font-bold text-blue-600">{stats.newWorkersThisMonth}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Avg Check-in Time</span>
                <span className="font-bold text-green-600">{stats.averageCheckInTime}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">On-time Rate</span>
                <span className={`font-bold ${
                  stats.onTimeRate >= 70 ? 'text-green-600' :
                  stats.onTimeRate >= 50 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {stats.onTimeRate}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Event Completion Rate</span>
                <span className="font-bold text-purple-600">{stats.completionRate}%</span>
              </div>
            </div>
          </div>

          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Performance Indicators</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600">Attendance Target (70%)</span>
                  <span className="text-sm font-medium text-gray-900">{stats.attendanceRate}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      stats.attendanceRate >= 70 ? 'bg-green-500' :
                      stats.attendanceRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(stats.attendanceRate, 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600">On-time Target (80%)</span>
                  <span className="text-sm font-medium text-gray-900">{stats.onTimeRate}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      stats.onTimeRate >= 80 ? 'bg-green-500' :
                      stats.onTimeRate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(stats.onTimeRate, 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600">Worker Retention</span>
                  <span className="text-sm font-medium text-gray-900">
                    {stats.totalWorkers > 0 ? Math.round((stats.activeWorkers / stats.totalWorkers) * 100) : 0}%
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${stats.totalWorkers > 0 ? (stats.activeWorkers / stats.totalWorkers) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
};

export default Dashboard;