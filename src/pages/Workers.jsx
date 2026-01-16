import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import SidebarLayout from '../layout/sidebar';
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
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [processing, setProcessing] = useState(false);
  const qrRef = useRef(null);
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    ministry: '',
    contact: '',
    status: 'Active'
  });
  const [formErrors, setFormErrors] = useState({});
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({
    ministry: '',
    contact: '',
    status: ''
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('newest');
  const [filterMinistry, setFilterMinistry] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

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
    return `WORKER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`.toUpperCase();
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
        query = query.or(`name.ilike.%${searchTerm}%,ministry.ilike.%${searchTerm}%,contact.ilike.%${searchTerm}%`);
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
    if (!formData.contact.trim()) errors.contact = 'Contact is required';
    
  
    if (/\d/.test(formData.first_name)) errors.first_name = 'First name cannot contain numbers';
    if (/\d/.test(formData.last_name)) errors.last_name = 'Last name cannot contain numbers';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };


  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

 
  const handleAddWorkerClick = () => {
    if (validateForm()) {
      setShowConfirmModal(true);
    }
  };


  const saveWorker = async () => {
    setProcessing(true);
    try {
      const newWorker = {
        name: `${formData.first_name} ${formData.last_name}`,
        ministry: formData.ministry,
        contact: formData.contact,
        status: formData.status,
        qr_value: generateQRValue()
      };

      const { data, error } = await supabase
        .from('workers')
        .insert([newWorker])
        .select();
      
      if (error) throw error;
      
      setShowConfirmModal(false);
      setShowAddModal(false);
      setFormData({ first_name: '', last_name: '', ministry: '', contact: '', status: 'Active' });
      

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
      const { error } = await supabase
        .from('workers')
        .update({
          ministry: editData.ministry,
          contact: editData.contact,
          status: editData.status
        })
        .eq('id', selectedWorker.id);
      
      if (error) throw error;
      
      setShowEditModal(false);
      setSelectedWorker(null);
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
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
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
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            + Add Worker
          </button>
        </div>

        
        <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          <input
            type="text"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-1/3 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

        
          <div className="flex flex-wrap items-center gap-3">
      
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="newest">Newest Added</option>
              <option value="oldest">Oldest Added</option>
              <option value="az">Sort A–Z</option>
              <option value="za">Sort Z–A</option>
            </select>

          
            <select
              value={filterMinistry}
              onChange={(e) => setFilterMinistry(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="Active">Active</option>
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {workers.map((worker) => (
                      <tr key={worker.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => {
                              setSelectedWorker(worker);
                              setShowQRModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-sm transition-all"
                          >
                            View QR
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{worker.name}</td>
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
                                : 'bg-red-100 text-red-800 hover:bg-red-200'
                            } transition-colors`}
                          >
                            {worker.status}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(worker.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                setSelectedWorker(worker);
                                setEditData({
                                  ministry: worker.ministry,
                                  contact: worker.contact,
                                  status: worker.status
                                });
                                setShowEditModal(true);
                              }}
                              className="text-yellow-600 hover:text-yellow-800 hover:underline font-medium transition-all"
                            >
                              Edit
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                              onClick={() => {
                                setSelectedWorker(worker);
                                setShowDeleteModal(true);
                              }}
                              className="text-red-600 hover:text-red-800 hover:underline font-medium transition-all"
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
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700">
                  Page {currentPage} of {totalPages || 1}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>

       
        {showAddModal && (
          <Modal onClose={() => setShowAddModal(false)} title="Add New Worker">
            <div className="space-y-4">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Ministry *</label>
                <select
                  name="ministry"
                  value={formData.ministry}
                  onChange={handleFormChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact *</label>
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Active">Active</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddWorkerClick}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add Worker
                </button>
              </div>
            </div>
          </Modal>
        )}

        
        {showConfirmModal && (
          <Modal onClose={() => setShowConfirmModal(false)} title="Confirm Worker Details">
            <div className="space-y-3">
              <p className="text-gray-700">Please confirm the following worker details:</p>
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <p><span className="font-medium">Name:</span> {formData.first_name} {formData.last_name}</p>
                <p><span className="font-medium">Ministry:</span> {formData.ministry}</p>
                <p><span className="font-medium">Contact:</span> {formData.contact}</p>
                <p><span className="font-medium">Status:</span> {formData.status}</p>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  disabled={processing}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
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
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
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
                    <p className="text-sm text-gray-600">Worker ID:</p>
                    <p className="text-xs font-mono bg-gray-100 px-3 py-1 rounded mt-1">{selectedWorker.qr_value}</p>
                  </div>
                  <div className="flex space-x-3 w-full">
                    <button
                      onClick={downloadQRCode}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Download QR
                    </button>
                    <button
                      onClick={() => setShowQRModal(false)}
                      className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showStatusModal && selectedWorker && (
          <Modal onClose={() => setShowStatusModal(false)} title="Confirm Status Change">
            <div className="space-y-4">
              <p className="text-gray-700">
                Are you sure you want to change the status of <span className="font-medium">{selectedWorker.name}</span> from{' '}
                <span className="font-medium">{selectedWorker.status}</span> to{' '}
                <span className="font-medium">{selectedWorker.status === 'Active' ? 'Suspended' : 'Active'}</span>?
              </p>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setShowStatusModal(false)}
                  disabled={processing}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={toggleStatus}
                  disabled={processing}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                >
                  {processing ? 'Updating...' : 'Confirm'}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {showEditModal && selectedWorker && (
          <Modal onClose={() => setShowEditModal(false)} title={`Edit Worker - ${selectedWorker.name}`}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ministry *</label>
                <select
                  value={editData.ministry}
                  onChange={(e) => setEditData({...editData, ministry: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Ministry</option>
                  {MINISTRIES.map(ministry => (
                    <option key={ministry} value={ministry}>{ministry}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact *</label>
                <input
                  type="text"
                  value={editData.contact}
                  onChange={(e) => setEditData({...editData, contact: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={editData.status}
                  onChange={(e) => setEditData({...editData, status: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Active">Active</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setShowEditModal(false)}
                  disabled={processing}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={updateWorker}
                  disabled={processing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {processing ? 'Updating...' : 'Update Worker'}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {showDeleteModal && selectedWorker && (
          <Modal onClose={() => setShowDeleteModal(false)} title="Confirm Deletion">
            <div className="space-y-4">
              <p className="text-gray-700">
                Are you sure you want to delete <span className="font-medium">{selectedWorker.name}</span>? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={processing}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={deleteWorker}
                  disabled={processing}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
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

function Modal({ children, onClose, title }) {
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}