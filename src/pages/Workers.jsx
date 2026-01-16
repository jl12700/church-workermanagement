import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import SidebarLayout from '../layout/Sidebar';
import { supabase } from '../database/supabase';

export default function Workers() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const qrRef = useRef(null);
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    ministry: '',
    contact: '',
    status: 'Active',
    gender: 'Prefer not to say',
    date_of_birth: '',
    present_address: '',
    email: '',
    educational_background: '',
    occupation: '',
    civil_status: 'Single',
    date_of_baptism: '',
    date_started_ministry: '',
    profile_photo: null,
    policy_pdf: null
  });
  
  const [formErrors, setFormErrors] = useState({});
  const [editData, setEditData] = useState({
    ministry: '',
    contact: '',
    status: '',
    gender: '',
    date_of_birth: '',
    present_address: '',
    email: '',
    educational_background: '',
    occupation: '',
    civil_status: '',
    date_of_baptism: '',
    date_started_ministry: '',
    profile_photo_url: '',
    policy_pdf_url: '',
    profile_photo: null,
    policy_pdf: null,
    status_note: ''
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('newest');
  const [filterMinistry, setFilterMinistry] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [profilePreview, setProfilePreview] = useState(null);
  const [policyFileName, setPolicyFileName] = useState('');
  const [uploadProgress, setUploadProgress] = useState({ profile: 0, policy: 0 });
  const [editProfilePreview, setEditProfilePreview] = useState(null);
  const [editPolicyFileName, setEditPolicyFileName] = useState('');

  const ROWS_PER_PAGE = 50;
  const MINISTRIES = [
    'Preacher',
    'Teacher',
    'Worship Team',
    'Tech-prod',
    'Faces',
    'C-Cube',
    'Comrades'
  ];

  const generateQRValue = () => {
    const timestamp = Date.now().toString(36); 
    const random = Math.random().toString(36).substr(2, 6);
    return `WRK-${timestamp}-${random}`.toUpperCase();
  };

  const fetchWorkers = async (page = 1) => {
    setLoading(true);
    try {
      const from = (page - 1) * ROWS_PER_PAGE;
      const to = from + ROWS_PER_PAGE - 1;
      
      let query = supabase
        .from('workers')
        .select('*', { count: 'exact' });
      
      if (searchTerm.trim()) {
        query = query.or(`name.ilike.%${searchTerm}%,ministry.ilike.%${searchTerm}%,contact.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,occupation.ilike.%${searchTerm}%`);
      }
      
      if (filterMinistry) {
        query = query.eq('ministry', filterMinistry);
      }
      
      if (filterStatus) {
        query = query.eq('status', filterStatus);
      }
      
      switch (sortOption) {
        case 'az':
          query = query.order('name', { ascending: true });
          break;
        case 'za':
          query = query.order('name', { ascending: false });
          break;
        case 'oldest':
          query = query.order('created_at', { ascending: true });
          break;
        case 'newest':
        default:
          query = query.order('created_at', { ascending: false });
          break;
      }
      
      query = query.range(from, to);
      
      const { data, count, error } = await query;
      
      if (error) throw error;
      
      setWorkers(data || []);
      setTotalCount(count || 0);
      setTotalPages(Math.ceil((count || 0) / ROWS_PER_PAGE));
    } catch (error) {
      console.error('Error fetching workers:', error);
      alert('Failed to load workers. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    fetchWorkers(1);
  }, [searchTerm, filterMinistry, filterStatus, sortOption]);

  useEffect(() => {
    fetchWorkers(currentPage);
  }, [currentPage]);

  const validateForm = () => {
    const errors = {};
    if (!formData.first_name.trim()) errors.first_name = 'First name is required';
    if (!formData.last_name.trim()) errors.last_name = 'Last name is required';
    if (!formData.ministry) errors.ministry = 'Ministry is required';
    if (!formData.contact.trim()) errors.contact = 'Contact Number is required';
    
    if (/\d/.test(formData.first_name)) errors.first_name = 'First name cannot contain numbers';
    if (/\d/.test(formData.last_name)) errors.last_name = 'Last name cannot contain numbers';
    
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }
    
    if (formData.date_of_birth) {
      const dob = new Date(formData.date_of_birth);
      const today = new Date();
      if (dob > today) errors.date_of_birth = 'Date of birth cannot be in the future';
    }
    
    if (formData.date_of_baptism) {
      const baptism = new Date(formData.date_of_baptism);
      const today = new Date();
      if (baptism > today) errors.date_of_baptism = 'Baptism date cannot be in the future';
    }
    
    if (formData.date_started_ministry) {
      const ministryStart = new Date(formData.date_started_ministry);
      const today = new Date();
      if (ministryStart > today) errors.date_started_ministry = 'Ministry start date cannot be in the future';
    }
    
    if (formData.profile_photo) {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
      if (!validTypes.includes(formData.profile_photo.type)) {
        errors.profile_photo = 'Only JPG, JPEG, and PNG files are allowed';
      }
      if (formData.profile_photo.size > 2 * 1024 * 1024) {
        errors.profile_photo = 'Profile photo must be less than 2MB';
      }
    }
    
    if (formData.policy_pdf) {
      if (formData.policy_pdf.type !== 'application/pdf') {
        errors.policy_pdf = 'Only PDF files are allowed';
      }
      if (formData.policy_pdf.size > 5 * 1024 * 1024) {
        errors.policy_pdf = 'Policy PDF must be less than 5MB';
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormChange = (e) => {
    const { name, value, type, files } = e.target;
    
    if (type === 'file') {
      if (name === 'profile_photo' && files[0]) {
        setFormData(prev => ({ ...prev, [name]: files[0] }));
        setProfilePreview(URL.createObjectURL(files[0]));
      } else if (name === 'policy_pdf' && files[0]) {
        setFormData(prev => ({ ...prev, [name]: files[0] }));
        setPolicyFileName(files[0].name);
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleEditFormChange = (e) => {
    const { name, value, type, files } = e.target;
    
    if (type === 'file') {
      if (name === 'profile_photo' && files[0]) {
        setEditData(prev => ({ ...prev, [name]: files[0] }));
        setEditProfilePreview(URL.createObjectURL(files[0]));
      } else if (name === 'policy_pdf' && files[0]) {
        setEditData(prev => ({ ...prev, [name]: files[0] }));
        setEditPolicyFileName(files[0].name);
      }
    } else {
      setEditData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleAddWorkerClick = () => {
    if (validateForm()) {
      setShowConfirmModal(true);
    }
  };

  const uploadProfilePhoto = async (workerId, file) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `profile.${fileExt}`;
      const filePath = `${workerId}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('worker-photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          onUploadProgress: (progress) => {
            const percentage = Math.round((progress.loaded / progress.total) * 100);
            setUploadProgress(prev => ({ ...prev, profile: percentage }));
          }
        });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('worker-photos')
        .getPublicUrl(filePath);
      
      return publicUrl;
    } catch (error) {
      console.error('Error uploading profile photo:', error);
      throw error;
    }
  };

  const uploadPolicyPDF = async (workerId, file) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `signed_policy.${fileExt}`;
      const filePath = `${workerId}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('ministry-policies')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          onUploadProgress: (progress) => {
            const percentage = Math.round((progress.loaded / progress.total) * 100);
            setUploadProgress(prev => ({ ...prev, policy: percentage }));
          }
        });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('ministry-policies')
        .getPublicUrl(filePath);
      
      return publicUrl;
    } catch (error) {
      console.error('Error uploading policy PDF:', error);
      throw error;
    }
  };

  const uploadWorkerFiles = async (workerId, profileFile, policyFile) => {
    setFileUploading(true);
    setUploadProgress({ profile: 0, policy: 0 });
    
    try {
      let profileUrl = null;
      let policyUrl = null;
      
      if (profileFile) {
        profileUrl = await uploadProfilePhoto(workerId, profileFile);
      }
      
      if (policyFile) {
        policyUrl = await uploadPolicyPDF(workerId, policyFile);
      }
      
      const updates = {};
      if (profileUrl) updates.profile_photo_url = profileUrl;
      if (policyUrl) updates.policy_pdf_url = policyUrl;
      
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('workers')
          .update(updates)
          .eq('id', workerId);
        
        if (updateError) throw updateError;
      }
      
      return { profileUrl, policyUrl };
    } catch (error) {
      console.error('Error uploading files:', error);
      throw error;
    } finally {
      setFileUploading(false);
      setUploadProgress({ profile: 0, policy: 0 });
    }
  };

  const saveWorker = async () => {
    setProcessing(true);
    try {
      const qrValue = generateQRValue();
      const newWorker = {
        name: `${formData.first_name} ${formData.last_name}`,
        ministry: formData.ministry,
        contact: formData.contact,
        status: formData.status,
        qr_value: qrValue,
        qr_created: new Date().toISOString(),
        gender: formData.gender,
        date_of_birth: formData.date_of_birth || null,
        present_address: formData.present_address,
        email: formData.email || null,
        educational_background: formData.educational_background,
        occupation: formData.occupation,
        civil_status: formData.civil_status,
        date_of_baptism: formData.date_of_baptism || null,
        date_started_ministry: formData.date_started_ministry || null
      };

      const { data, error } = await supabase
        .from('workers')
        .insert([newWorker])
        .select();
      
      if (error) throw error;
      
      const savedWorker = data[0];
      
      if (formData.profile_photo || formData.policy_pdf) {
        await uploadWorkerFiles(savedWorker.id, formData.profile_photo, formData.policy_pdf);
      }
      
      setShowConfirmModal(false);
      setShowAddModal(false);
      
      setFormData({
        first_name: '',
        last_name: '',
        ministry: '',
        contact: '',
        status: 'Active',
        gender: 'Prefer not to say',
        date_of_birth: '',
        present_address: '',
        email: '',
        educational_background: '',
        occupation: '',
        civil_status: 'Single',
        date_of_baptism: '',
        date_started_ministry: '',
        profile_photo: null,
        policy_pdf: null
      });
      setProfilePreview(null);
      setPolicyFileName('');
      
      setCurrentPage(1);
      fetchWorkers(1);
    } catch (error) {
      console.error('Error saving worker:', error);
      alert('Failed to save worker. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const toggleStatus = async () => {
    setProcessing(true);
    try {
      const newStatus = selectedWorker.status === 'Active' ? 'Suspended' : 'Active';
      
      const { error } = await supabase
        .from('workers')
        .update({ status: newStatus })
        .eq('id', selectedWorker.id);
      
      if (error) throw error;
      
      setShowStatusModal(false);
      setSelectedWorker(null);
      fetchWorkers(currentPage);
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const updateWorker = async () => {
    setProcessing(true);
    try {
      const updates = {
        ministry: editData.ministry,
        contact: editData.contact,
        status: editData.status,
        gender: editData.gender,
        date_of_birth: editData.date_of_birth || null,
        present_address: editData.present_address,
        email: editData.email || null,
        educational_background: editData.educational_background,
        occupation: editData.occupation,
        civil_status: editData.civil_status,
        date_of_baptism: editData.date_of_baptism || null,
        date_started_ministry: editData.date_started_ministry || null,
        status_note: editData.status_note || null
      };

      const { error } = await supabase
        .from('workers')
        .update(updates)
        .eq('id', selectedWorker.id);
      
      if (error) throw error;
      
      if (editData.profile_photo || editData.policy_pdf) {
        await uploadWorkerFiles(selectedWorker.id, editData.profile_photo, editData.policy_pdf);
      }
      
      setShowEditModal(false);
      setSelectedWorker(null);
      setEditProfilePreview(null);
      setEditPolicyFileName('');
      fetchWorkers(currentPage);
    } catch (error) {
      console.error('Error updating worker:', error);
      alert('Failed to update worker. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const deleteWorker = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('workers')
        .delete()
        .eq('id', selectedWorker.id);
      
      if (error) throw error;
      
      setShowDeleteModal(false);
      setSelectedWorker(null);
      
      if (workers.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      } else {
        fetchWorkers(currentPage);
      }
    } catch (error) {
      console.error('Error deleting worker:', error);
      alert('Failed to delete worker. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const downloadQRCode = () => {
    if (!qrRef.current || !selectedWorker) return;
    
    const svg = qrRef.current.querySelector('svg');
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = 400;
      canvas.height = 480;
      
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.drawImage(img, 50, 20, 300, 300);
      
      ctx.fillStyle = 'black';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(selectedWorker.name, 200, 350);
      
      ctx.font = '16px Arial';
      ctx.fillText(selectedWorker.ministry, 200, 380);
      
      ctx.font = '12px Arial';
      ctx.fillStyle = '#666';
      ctx.fillText(`ID: ${selectedWorker.qr_value}`, 200, 400);
      
      ctx.fillText('Scan to check in', 200, 420);
      
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `${selectedWorker.name.replace(/\s+/g, '_')}_QR.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterMinistry('');
    setFilterStatus('');
    setSortOption('newest');
  };

  const getQRCodeValue = (worker) => {
    return worker.qr_value;
  };

  const testQRCode = (worker) => {
    alert(`Scanner will read:\n\n${worker.qr_value}\n\nThis should match exactly what's in the database.`);
  };

  const handleViewDetails = (worker) => {
    setSelectedWorker(worker);
    setShowDetailsModal(true);
  };

  const handleEditWorker = (worker) => {
    setSelectedWorker(worker);
    setEditData({
      ministry: worker.ministry || '',
      contact: worker.contact || '',
      status: worker.status || '',
      gender: worker.gender || 'Prefer not to say',
      date_of_birth: worker.date_of_birth || '',
      present_address: worker.present_address || '',
      email: worker.email || '',
      educational_background: worker.educational_background || '',
      occupation: worker.occupation || '',
      civil_status: worker.civil_status || 'Single',
      date_of_baptism: worker.date_of_baptism || '',
      date_started_ministry: worker.date_started_ministry || '',
      profile_photo_url: worker.profile_photo_url || '',
      policy_pdf_url: worker.policy_pdf_url || '',
      profile_photo: null,
      policy_pdf: null,
      status_note: worker.status_note || ''
    });
    setEditProfilePreview(worker.profile_photo_url || null);
    setEditPolicyFileName('');
    setShowEditModal(true);
  };

  
  const handleProfilePhotoSelect = () => {
    document.getElementById('profile-photo-input').click();
  };

  const handlePolicyPDFSelect = () => {
    document.getElementById('policy-pdf-input').click();
  };

  
  const handleEditProfilePhotoSelect = () => {
    document.getElementById('edit-profile-photo-input').click();
  };

  const handleEditPolicyPDFSelect = () => {
    document.getElementById('edit-policy-pdf-input').click();
  };

  return (
    <SidebarLayout>
      <div className="p-6">
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Workers Management</h1>
            <p className="text-sm text-gray-500 mt-1">
              Total Workers: {totalCount}
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            + Add Worker
          </button>
        </div>

        <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <input
            type="text"
            placeholder="Search by name, email, occupation..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-1/3 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              className="cursor-pointer px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="newest">Newest Added</option>
              <option value="oldest">Oldest Added</option>
              <option value="az">Sort A–Z</option>
              <option value="za">Sort Z–A</option>
            </select>

            <select
              value={filterMinistry}
              onChange={(e) => setFilterMinistry(e.target.value)}
              className="cursor-pointer px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Ministries</option>
              {MINISTRIES.map((ministry) => (
                <option key={ministry} value={ministry}>
                  {ministry}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="cursor-pointer px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Suspended">Suspended</option>
            </select>

            {(searchTerm || filterMinistry || filterStatus || sortOption !== 'newest') && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:underline"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : workers.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <p className="text-lg">No workers found</p>
              <p className="text-sm mt-2">Click "Add Worker" to get started</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">QR</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ministry</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Added</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {workers.map((worker) => (
                      <tr key={worker.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => {
                                setSelectedWorker(worker);
                                setShowQRModal(true);
                              }}
                              className="cursor-pointer text-blue-600 hover:text-blue-800 hover:underline font-medium text-sm transition-all"
                            >
                              View QR
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{worker.name}</div>
                            <div className="text-xs text-gray-500">{worker.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{worker.ministry}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{worker.contact}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => {
                              setSelectedWorker(worker);
                              setShowStatusModal(true);
                            }}
                            className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              worker.status === 'Active' 
                                ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                                : worker.status === 'Inactive'
                                ? 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                                : 'bg-red-100 text-red-800 hover:bg-red-200'
                            } transition-colors`}
                          >
                            {worker.status}
                            {worker.status_note && worker.status === 'Suspended' && (
                              <span className="ml-1" title={worker.status_note}>ℹ️</span>
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(worker.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => handleViewDetails(worker)}
                              className="cursor-pointer text-blue-600 hover:text-blue-800 hover:underline font-medium text-sm transition-all"
                            >
                              Details
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                              onClick={() => handleEditWorker(worker)}
                              className="cursor-pointer text-yellow-600 hover:text-yellow-800 hover:underline font-medium text-sm transition-all"
                            >
                              Edit
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                              onClick={() => {
                                setSelectedWorker(worker);
                                setShowDeleteModal(true);
                              }}
                              className="cursor-pointer text-red-600 hover:text-red-800 hover:underline font-medium text-sm transition-all"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="cursor-pointer px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700">
                  Page {currentPage} of {totalPages || 1}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="cursor-pointer px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>

{showAddModal && (
  <Modal onClose={() => {
    setShowAddModal(false);
    setProfilePreview(null);
    setPolicyFileName('');
  }} title="Add New Worker" size="xlarge">
    <div className="space-y-6">

      <div className="border-b pb-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Personal Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
            <input
              type="text"
              name="first_name"
              value={formData.first_name}
              onChange={handleFormChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                formErrors.first_name ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {formErrors.first_name && <p className="text-red-500 text-xs mt-1">{formErrors.first_name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
            <input
              type="text"
              name="last_name"
              value={formData.last_name}
              onChange={handleFormChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                formErrors.last_name ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {formErrors.last_name && <p className="text-red-500 text-xs mt-1">{formErrors.last_name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleFormChange}
              className="cursor-pointer w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Prefer not to say">--Choose Gender--</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
            <input
              type="date"
              name="date_of_birth"
              value={formData.date_of_birth}
              onChange={handleFormChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                formErrors.date_of_birth ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {formErrors.date_of_birth && <p className="text-red-500 text-xs mt-1">{formErrors.date_of_birth}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Civil Status</label>
            <select
              name="civil_status"
              value={formData.civil_status}
              onChange={handleFormChange}
              className="cursor-pointer w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Single">Single</option>
              <option value="Married">Married</option>
              <option value="Widowed">Widowed</option>
              <option value="Separated">Separated</option>
            </select>
          </div>
        </div>
      </div>

      
      <div className="border-b pb-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Contact Information</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Present Address</label>
            <textarea
              name="present_address"
              value={formData.present_address}
              onChange={handleFormChange}
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleFormChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                formErrors.email ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number *</label>
            <input
              type="text"
              name="contact"
              value={formData.contact}
              onChange={handleFormChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                formErrors.contact ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {formErrors.contact && <p className="text-red-500 text-xs mt-1">{formErrors.contact}</p>}
          </div>
        </div>
      </div>

      
      <div className="border-b pb-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Professional Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Educational Background</label>
            <textarea
              name="educational_background"
              value={formData.educational_background}
              onChange={handleFormChange}
              rows="2"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Occupation</label>
            <input
              type="text"
              name="occupation"
              value={formData.occupation}
              onChange={handleFormChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ministry *</label>
            <select
              name="ministry"
              value={formData.ministry}
              onChange={handleFormChange}
              className={`cursor-pointer w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                formErrors.ministry ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select Ministry</option>
              {MINISTRIES.map(ministry => (
                <option key={ministry} value={ministry}>{ministry}</option>
              ))}
            </select>
            {formErrors.ministry && <p className="text-red-500 text-xs mt-1">{formErrors.ministry}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Started Ministry</label>
            <input
              type="date"
              name="date_started_ministry"
              value={formData.date_started_ministry}
              onChange={handleFormChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                formErrors.date_started_ministry ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {formErrors.date_started_ministry && <p className="text-red-500 text-xs mt-1">{formErrors.date_started_ministry}</p>}
          </div>
        </div>
      </div>

  
      <div className="border-b pb-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Ministry Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date of Baptism</label>
            <input
              type="date"
              name="date_of_baptism"
              value={formData.date_of_baptism}
              onChange={handleFormChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                formErrors.date_of_baptism ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {formErrors.date_of_baptism && <p className="text-red-500 text-xs mt-1">{formErrors.date_of_baptism}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleFormChange}
              className="cursor-pointer w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Suspended">Suspended</option>
            </select>
          </div>
        </div>
      </div>

      
      <div className="pb-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Attachments</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Profile Photo</label>
            <div className="flex flex-col items-center">
              {profilePreview ? (
                <div className="mb-3">
                  <img 
                    src={profilePreview} 
                    alt="Profile preview" 
                    className="w-32 h-32 rounded-full object-cover border-2 border-gray-300"
                  />
                  <button
                    type="button"
                    onClick={handleProfilePhotoSelect}
                    className="mt-2 cursor-pointer px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    Reupload Photo
                  </button>
                </div>
              ) : (
                <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center mb-3">
                  <span className="text-gray-500">No photo</span>
                </div>
              )}
              
              <input
                id="profile-photo-input"
                type="file"
                name="profile_photo"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleFormChange}
                className="hidden"
              />
              
              {!profilePreview && (
                <button
                  type="button"
                  onClick={handleProfilePhotoSelect}
                  className="cursor-pointer px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Upload Photo
                </button>
              )}
              
              <p className="text-xs text-gray-500 mt-1">JPG, PNG max 2MB</p>
              {formErrors.profile_photo && (
                <p className="text-red-500 text-xs mt-1">{formErrors.profile_photo}</p>
              )}
              {uploadProgress.profile > 0 && (
                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full" 
                    style={{ width: `${uploadProgress.profile}%` }}
                  ></div>
                  <p className="text-xs text-gray-600 mt-1">{uploadProgress.profile}% uploaded</p>
                </div>
              )}
            </div>
          </div>

          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Signed Ministry Policy</label>
            <div className="flex flex-col items-center border-2 border-dashed border-gray-300 rounded-lg p-4">
              {policyFileName ? (
                <div className="text-center">
                  <svg className="w-12 h-12 text-red-500 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm font-medium text-gray-700">{policyFileName}</p>
                  <button
                    type="button"
                    onClick={handlePolicyPDFSelect}
                    className="mt-2 cursor-pointer px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    Reupload PDF
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 01-2-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm text-gray-600 mb-2">Upload PDF file</p>
                  <button
                    type="button"
                    onClick={handlePolicyPDFSelect}
                    className="cursor-pointer px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Upload PDF File
                  </button>
                </div>
              )}
              
              <input
                id="policy-pdf-input"
                type="file"
                name="policy_pdf"
                accept="application/pdf"
                onChange={handleFormChange}
                className="hidden"
              />
              
              <p className="text-xs text-gray-500 mt-2">PDF max 5MB</p>
              {formErrors.policy_pdf && (
                <p className="text-red-500 text-xs mt-1">{formErrors.policy_pdf}</p>
              )}
              {uploadProgress.policy > 0 && (
                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                  <div 
                    className="bg-green-600 h-2.5 rounded-full" 
                    style={{ width: `${uploadProgress.policy}%` }}
                  ></div>
                  <p className="text-xs text-gray-600 mt-1">{uploadProgress.policy}% uploaded</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          onClick={() => {
            setShowAddModal(false);
            setProfilePreview(null);
            setPolicyFileName('');
          }}
          className="cursor-pointer px-4 py-2 border border-gray-300 rounded-lg text-gray-600 transition-all hover:bg-red-50 hover:border-red-200 hover:text-red-600"
        >
          Cancel
        </button>
        <button
          onClick={handleAddWorkerClick}
          disabled={processing || fileUploading}
          className="cursor-pointer px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing ? 'Saving...' : fileUploading ? 'Uploading...' : 'Add Worker'}
        </button>
      </div>
    </div>
  </Modal>
)}

        {showConfirmModal && (
  <Modal onClose={() => setShowConfirmModal(false)} title="Confirm Worker Details" size="medium">
    <div className="space-y-4">
      <p className="text-gray-700 font-medium">Please confirm the following worker details:</p>
      
      <div className="space-y-4">
       
        <div className="border rounded-lg p-4 bg-gray-50">
          <h4 className="font-semibold text-gray-800 mb-2">Personal Information</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-600">First Name:</span>
              <p className="font-medium">{formData.first_name}</p>
            </div>
            <div>
              <span className="text-gray-600">Last Name:</span>
              <p className="font-medium">{formData.last_name}</p>
            </div>
            <div>
              <span className="text-gray-600">Gender:</span>
              <p className="font-medium">{formData.gender}</p>
            </div>
            <div>
              <span className="text-gray-600">Date of Birth:</span>
              <p className="font-medium">{formData.date_of_birth || 'Not specified'}</p>
            </div>
            <div>
              <span className="text-gray-600">Civil Status:</span>
              <p className="font-medium">{formData.civil_status}</p>
            </div>
          </div>
        </div>

        
        <div className="border rounded-lg p-4 bg-gray-50">
          <h4 className="font-semibold text-gray-800 mb-2">Contact Information</h4>
          <div className="space-y-1 text-sm">
            <div>
              <span className="text-gray-600">Present Address:</span>
              <p className="font-medium">{formData.present_address || 'Not specified'}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-gray-600">Email:</span>
                <p className="font-medium">{formData.email || 'Not specified'}</p>
              </div>
              <div>
                <span className="text-gray-600">Contact Number:</span>
                <p className="font-medium">{formData.contact}</p>
              </div>
            </div>
          </div>
        </div>

        
        <div className="border rounded-lg p-4 bg-gray-50">
          <h4 className="font-semibold text-gray-800 mb-2">Professional Information</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-600">Educational Background:</span>
              <p className="font-medium">{formData.educational_background || 'Not specified'}</p>
            </div>
            <div>
              <span className="text-gray-600">Occupation:</span>
              <p className="font-medium">{formData.occupation || 'Not specified'}</p>
            </div>
            <div>
              <span className="text-gray-600">Ministry:</span>
              <p className="font-medium">{formData.ministry}</p>
            </div>
            <div>
              <span className="text-gray-600">Date Started Ministry:</span>
              <p className="font-medium">{formData.date_started_ministry || 'Not specified'}</p>
            </div>
          </div>
        </div>

        
        <div className="border rounded-lg p-4 bg-gray-50">
          <h4 className="font-semibold text-gray-800 mb-2">Ministry Information</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-600">Date of Baptism:</span>
              <p className="font-medium">{formData.date_of_baptism || 'Not specified'}</p>
            </div>
            <div>
              <span className="text-gray-600">Status:</span>
              <p className="font-medium">{formData.status}</p>
            </div>
            <div className="col-span-2">
              <span className="text-gray-600">QR ID:</span>
              <p className="font-medium font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                {generateQRValue()}
              </p>
            </div>
          </div>
        </div>

       
        <div className="border rounded-lg p-4 bg-gray-50">
          <h4 className="font-semibold text-gray-800 mb-2">Attachments</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="flex flex-col items-center">
              <label className="block text-sm font-medium text-gray-700 mb-2">Profile Photo</label>
              {formData.profile_photo ? (
                <div className="mb-3">
                  <img 
                    src={profilePreview} 
                    alt="Profile preview" 
                    className="w-24 h-24 rounded-full object-cover border-2 border-gray-300"
                  />
                  <p className="text-xs text-center text-gray-600 mt-1">
                    {formData.profile_photo.name}
                  </p>
                </div>
              ) : (
                <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center mb-3">
                  <span className="text-gray-500 text-xs">No photo</span>
                </div>
              )}
            </div>

            
            <div className="flex flex-col items-center">
              <label className="block text-sm font-medium text-gray-700 mb-2">Signed Ministry Policy</label>
              {formData.policy_pdf ? (
                <div className="text-center">
                  <svg className="w-16 h-16 text-red-500 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm font-medium text-gray-700">
                    {formData.policy_pdf.name}
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 01-2-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm text-gray-600">No PDF uploaded</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          onClick={() => setShowConfirmModal(false)}
          disabled={processing}
          className="cursor-pointer px-4 py-2 border border-gray-300 rounded-lg text-gray-600 transition-all hover:bg-red-50 hover:border-red-200 hover:text-red-600 active:bg-red-100"
        >
          Cancel
        </button>
        <button
          onClick={saveWorker}
          disabled={processing}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {processing ? 'Saving...' : 'Confirm & Save'}
        </button>
      </div>
    </div>
  </Modal>
)}

{showQRModal && selectedWorker && (
  <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">QR Code - {selectedWorker.name}</h2>
        <button
          onClick={() => setShowQRModal(false)}
          className="cursor-pointer text-gray-400 hover:text-gray-600 text-2xl leading-none"
        >
          ×
        </button>
      </div>
      <div className="px-6 py-6">
        <div className="flex flex-col items-center space-y-4">
          <div ref={qrRef} className="bg-white p-6 rounded-lg border-2 border-gray-200">
            <QRCodeSVG 
              value={selectedWorker.qr_value}  
              size={256}
              level="H"
              includeMargin={true}
            />
          </div>
          <div className="text-center">
            <p className="font-medium text-gray-800">{selectedWorker.name}</p>
            <p className="text-sm text-gray-600">{selectedWorker.ministry}</p>
            <p className="text-xs font-mono bg-gray-100 px-3 py-2 rounded break-all mt-2">
              {selectedWorker.qr_value}
            </p>
          </div>
          <div className="flex space-x-3 w-full">
            <button
              onClick={downloadQRCode}
              className="cursor-pointer flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Download QR
            </button>
            <button
              onClick={() => setShowQRModal(false)}
              className="cursor-pointer flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
)}

{showEditModal && selectedWorker && (
  <Modal onClose={() => {
    setShowEditModal(false);
    setEditProfilePreview(null);
    setEditPolicyFileName('');
  }} title={`Edit Worker - ${selectedWorker.name}`} size="large">
    
  </Modal>
)}

        {showEditModal && selectedWorker && (
          <Modal onClose={() => {
            setShowEditModal(false);
            setEditProfilePreview(null);
            setEditPolicyFileName('');
          }} title={`Edit Worker - ${selectedWorker.name}`} size="large">
            <div className="space-y-6">
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                    <select
                      value={editData.gender}
                      onChange={handleEditFormChange}
                      name="gender"
                      className="cursor-pointer w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                    <input
                      type="date"
                      value={editData.date_of_birth}
                      onChange={handleEditFormChange}
                      name="date_of_birth"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Civil Status</label>
                    <select
                      value={editData.civil_status}
                      onChange={handleEditFormChange}
                      name="civil_status"
                      className="cursor-pointer w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Widowed">Widowed</option>
                      <option value="Separated">Separated</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Contact Information</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Present Address</label>
                    <textarea
                      value={editData.present_address}
                      onChange={handleEditFormChange}
                      name="present_address"
                      rows="3"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={editData.email}
                      onChange={handleEditFormChange}
                      name="email"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number *</label>
                    <input
                      type="text"
                      value={editData.contact}
                      onChange={handleEditFormChange}
                      name="contact"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Professional Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Educational Background</label>
                    <textarea
                      value={editData.educational_background}
                      onChange={handleEditFormChange}
                      name="educational_background"
                      rows="2"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Occupation</label>
                    <input
                      type="text"
                      value={editData.occupation}
                      onChange={handleEditFormChange}
                      name="occupation"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ministry *</label>
                    <select
                      value={editData.ministry}
                      onChange={handleEditFormChange}
                      name="ministry"
                      className="cursor-pointer w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Ministry</option>
                      {MINISTRIES.map(ministry => (
                        <option key={ministry} value={ministry}>{ministry}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date Started Ministry</label>
                    <input
                      type="date"
                      value={editData.date_started_ministry}
                      onChange={handleEditFormChange}
                      name="date_started_ministry"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Ministry Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of Baptism</label>
                    <input
                      type="date"
                      value={editData.date_of_baptism}
                      onChange={handleEditFormChange}
                      name="date_of_baptism"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={editData.status}
                      onChange={handleEditFormChange}
                      name="status"
                      className="cursor-pointer w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Suspended">Suspended</option>
                    </select>
                  </div>
                </div>
                {editData.status === 'Suspended' && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Suspension Note (Optional)
                    </label>
                    <textarea
                      value={editData.status_note}
                      onChange={handleEditFormChange}
                      name="status_note"
                      rows="2"
                      placeholder="e.g., Suspended for 2 weeks due to..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Add a note explaining the suspension reason and duration
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Attachments</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Profile Photo</label>
                    <div className="flex flex-col items-center">
                      {(editProfilePreview || editData.profile_photo_url) ? (
                        <div className="mb-3">
                          <img 
                            src={editProfilePreview || editData.profile_photo_url} 
                            alt="Profile" 
                            className="w-32 h-32 rounded-full object-cover border-2 border-gray-300"
                          />
                          <div className="flex space-x-2 mt-2">
                            <button
                              type="button"
                              onClick={handleEditProfilePhotoSelect}
                              className="cursor-pointer px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                            >
                              Reupload Photo
                            </button>
                            {editData.profile_photo_url && !editProfilePreview && (
                              <a
                                href={editData.profile_photo_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="cursor-pointer px-3 py-1 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
                              >
                                View Current
                              </a>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center mb-3">
                          <span className="text-gray-500">No photo</span>
                        </div>
                      )}
                      
                      <input
                        id="edit-profile-photo-input"
                        type="file"
                        name="profile_photo"
                        accept="image/jpeg,image/jpg,image/png"
                        onChange={handleEditFormChange}
                        className="hidden"
                      />
                      
                      {!editProfilePreview && !editData.profile_photo_url && (
                        <button
                          type="button"
                          onClick={handleEditProfilePhotoSelect}
                          className="cursor-pointer px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Upload Photo
                        </button>
                      )}
                      
                      <p className="text-xs text-gray-500 mt-1">JPG, PNG max 2MB</p>
                      {uploadProgress.profile > 0 && (
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                          <div 
                            className="bg-blue-600 h-2.5 rounded-full" 
                            style={{ width: `${uploadProgress.profile}%` }}
                          ></div>
                          <p className="text-xs text-gray-600 mt-1">{uploadProgress.profile}% uploaded</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Signed Ministry Policy</label>
                    <div className="flex flex-col items-center border-2 border-dashed border-gray-300 rounded-lg p-4">
                      {(editPolicyFileName || editData.policy_pdf_url) ? (
                        <div className="text-center">
                          <svg className="w-12 h-12 text-red-500 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                          </svg>
                          <p className="text-sm font-medium text-gray-700">
                            {editPolicyFileName || 'Signed Policy.pdf'}
                          </p>
                          <div className="flex space-x-2 mt-2">
                            <button
                              type="button"
                              onClick={handleEditPolicyPDFSelect}
                              className="cursor-pointer px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                            >
                              Reupload PDF
                            </button>
                            {editData.policy_pdf_url && !editPolicyFileName && (
                              <a
                                href={editData.policy_pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="cursor-pointer px-3 py-1 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
                              >
                                View Current
                              </a>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center">
                          <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 01-2-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <p className="text-sm text-gray-600 mb-2">Upload PDF file</p>
                          <button
                            type="button"
                            onClick={handleEditPolicyPDFSelect}
                            className="cursor-pointer px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            Upload PDF File
                          </button>
                        </div>
                      )}
                      
                      <input
                        id="edit-policy-pdf-input"
                        type="file"
                        name="policy_pdf"
                        accept="application/pdf"
                        onChange={handleEditFormChange}
                        className="hidden"
                      />
                      
                      <p className="text-xs text-gray-500 mt-2">PDF max 5MB</p>
                      {uploadProgress.policy > 0 && (
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                          <div 
                            className="bg-green-600 h-2.5 rounded-full" 
                            style={{ width: `${uploadProgress.policy}%` }}
                          ></div>
                          <p className="text-xs text-gray-600 mt-1">{uploadProgress.policy}% uploaded</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditProfilePreview(null);
                    setEditPolicyFileName('');
                  }}
                  disabled={processing}
                  className="cursor-pointer px-4 py-2 border border-gray-300 rounded-lg text-gray-600 transition-all hover:bg-red-50 hover:border-red-200 hover:text-red-600 active:bg-red-100"
                >
                  Cancel
                </button>
                <button
                  onClick={updateWorker}
                  disabled={processing}
                  className="cursor-pointer px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {processing ? 'Updating...' : 'Update Worker'}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {showDetailsModal && selectedWorker && (
          <Modal onClose={() => setShowDetailsModal(false)} title={`Worker Details - ${selectedWorker.name}`} size="large">
            <div className="space-y-6">
              
              <div className="flex flex-col items-center mb-6">
                {selectedWorker.profile_photo_url ? (
                  <div className="flex flex-col items-center">
                    <img 
                      src={selectedWorker.profile_photo_url} 
                      alt="Profile" 
                      className="w-40 h-40 rounded-full object-cover border-4 border-blue-100 shadow-lg"
                    />
                    <a
                      href={selectedWorker.profile_photo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 text-blue-600 hover:text-blue-800 hover:underline font-medium"
                    >
                      View Full Image
                    </a>
                  </div>
                ) : (
                  <div className="w-40 h-40 rounded-full bg-gray-200 flex items-center justify-center border-4 border-blue-100">
                    <span className="text-gray-500">No profile photo</span>
                  </div>
                )}
                <h2 className="text-2xl font-bold text-gray-800 mt-4">{selectedWorker.name}</h2>
                <div className="flex items-center space-x-4 mt-2">
                  <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                    selectedWorker.status === 'Active' 
                      ? 'bg-green-100 text-green-800' 
                      : selectedWorker.status === 'Inactive'
                      ? 'bg-gray-100 text-gray-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {selectedWorker.status}
                  </span>
                  <span className="text-sm text-gray-600">{selectedWorker.ministry}</span>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Gender</p>
                    <p className="font-medium">{selectedWorker.gender || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Date of Birth</p>
                    <p className="font-medium">
                      {selectedWorker.date_of_birth ? new Date(selectedWorker.date_of_birth).toLocaleDateString() : 'Not specified'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Civil Status</p>
                    <p className="font-medium">{selectedWorker.civil_status || 'Not specified'}</p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Contact Information</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-500">Present Address</p>
                    <p className="font-medium">{selectedWorker.present_address || 'Not specified'}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="font-medium">{selectedWorker.email || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Contact Number</p>
                      <p className="font-medium">{selectedWorker.contact}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Professional Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Educational Background</p>
                    <p className="font-medium">{selectedWorker.educational_background || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Occupation</p>
                    <p className="font-medium">{selectedWorker.occupation || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Ministry</p>
                    <p className="font-medium">{selectedWorker.ministry}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Date Started Ministry</p>
                    <p className="font-medium">
                      {selectedWorker.date_started_ministry ? new Date(selectedWorker.date_started_ministry).toLocaleDateString() : 'Not specified'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Ministry Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Date of Baptism</p>
                    <p className="font-medium">
                      {selectedWorker.date_of_baptism ? new Date(selectedWorker.date_of_baptism).toLocaleDateString() : 'Not specified'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <div>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        selectedWorker.status === 'Active' 
                          ? 'bg-green-100 text-green-800' 
                          : selectedWorker.status === 'Inactive'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {selectedWorker.status}
                      </span>
                      {selectedWorker.status_note && selectedWorker.status === 'Suspended' && (
                        <p className="text-sm text-gray-600 mt-1">
                          <span className="font-medium">Note:</span> {selectedWorker.status_note}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Attachments</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium text-gray-700 mb-2">Profile Photo</h4>
                    {selectedWorker.profile_photo_url ? (
                      <div className="flex flex-col items-center">
                        <a
                          href={selectedWorker.profile_photo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          View Full Image
                        </a>
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">No profile photo uploaded</p>
                    )}
                  </div>
                  
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium text-gray-700 mb-2">Signed Ministry Policy</h4>
                    {selectedWorker.policy_pdf_url ? (
                      <div className="flex flex-col items-center">
                        <svg className="w-16 h-16 text-red-500 mb-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                        <a
                          href={selectedWorker.policy_pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 hover:underline mb-2"
                        >
                          View PDF
                        </a>
                        <a
                          href={selectedWorker.policy_pdf_url}
                          download
                          className="text-green-600 hover:text-green-800 hover:underline"
                        >
                          Download PDF
                        </a>
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">No policy PDF uploaded</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="cursor-pointer px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </Modal>
        )}

        {showDeleteModal && selectedWorker && (
          <Modal onClose={() => setShowDeleteModal(false)} title="Confirm Deletion" size="small">
            <div className="space-y-4">
              <p className="text-gray-700">
                Are you sure you want to delete <span className="font-medium">{selectedWorker.name}</span>? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={processing}
                  className="cursor-pointer px-4 py-2 border border-gray-300 rounded-lg text-gray-600 transition-all hover:bg-red-50 hover:border-red-200 hover:text-red-600 active:bg-red-100"
                >
                  Cancel
                </button>
                <button
                  onClick={deleteWorker}
                  disabled={processing}
                  className="cursor-pointer px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-900 hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {processing ? 'Deleting...' : 'Delete Worker'}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </SidebarLayout>
  );
}

function Modal({ children, onClose, title, size = 'medium' }) {
  
  const sizeClasses = {
    small: 'max-w-md',
    medium: 'max-w-2xl',
    large: 'max-w-4xl',
    xlarge: 'max-w-6xl'
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-lg ${sizeClasses[size]} w-full shadow-xl flex flex-col max-h-[90vh]`}>
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
            <button
              onClick={onClose}
              className="cursor-pointer text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>
        <div className="px-6 py-4 overflow-y-auto flex-grow">
          {children}
        </div>
      </div>
    </div>
  );
}