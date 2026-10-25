import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Search,
  Filter,
  Edit2,
  UserX,
  CheckCircle2,
  Clock,
  School as SchoolIcon,
  MapPin,
  Lock,
  KeyRound,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';
import { UserProfile, UserInvitation, School, Region, UserRole, UserStatus } from '../../types';
import { authService, BOOTSTRAP_ADMIN_EMAIL } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';

interface UserManagementViewProps {
  schools: School[];
  regions: Region[];
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({ schools, regions }) => {
  const { isSuperAdmin, currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [invitations, setInvitations] = useState<UserInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createPassword, setCreatePassword] = useState('');
  const [createPasswordConfirm, setCreatePasswordConfirm] = useState('');
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [editPassword, setEditPassword] = useState('');
  const [editPasswordConfirm, setEditPasswordConfirm] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [deleting, setDeleting] = useState<string|null>(null);

  // Invite Form
  const [inviteForm, setInviteForm] = useState({
    displayName: '',
    email: '',
    position: '',
    role: 'SCHOOL_OPERATOR' as UserRole,
    assignedRegions: [] as string[],
    assignedSchools: [] as string[]
  });

  // Edit User Form
  const [editForm, setEditForm] = useState({
    displayName: '',
    position: '',
    role: 'SCHOOL_OPERATOR' as UserRole,
    status: 'ACTIVE' as UserStatus,
    assignedRegions: [] as string[],
    assignedSchools: [] as string[]
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [uList, invList] = await Promise.all([
        authService.getAllUsers(),
        authService.getAllInvitations()
      ]);
      setUsers(uList);
      setInvitations(invList);
    } catch (e) {
      console.error('Error loading users:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openInviteModal = () => {
    setInviteForm({
      displayName: '',
      email: '',
      position: 'Operator Sekolah',
      role: 'SCHOOL_OPERATOR',
      assignedRegions: [],
      assignedSchools: []
    });
    setCreatePassword('');setCreatePasswordConfirm('');setShowCreatePassword(false);
    setInviteModalOpen(true);
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!inviteForm.email.trim() || !inviteForm.displayName.trim()){
      alert('Email dan nama lengkap wajib diisi.');return;
    }
    if(createPassword.length<12||!/\d/.test(createPassword)||!/[a-zA-Z]/.test(createPassword)){
      alert('Buat sandi minimal 12 karakter, mengandung huruf dan angka.');return;
    }
    if(createPassword!==createPasswordConfirm){
      alert('Konfirmasi sandi belum sama.');return;
    }
    setSubmitting(true);
    try{
      const result=await authService.createAuthorizedUser({...inviteForm,password:createPassword});
      setCreatePassword('');setCreatePasswordConfirm('');
      setInviteModalOpen(false);
      await loadData();
      alert(result.message||'Akun berhasil dibuat dan dapat login menggunakan email serta sandi.');
    }catch(err:any){alert(err.message||'Gagal membuat akun pengguna');}
    finally{setSubmitting(false);}
  };

  const openEditModal = (user: UserProfile) => {
    setSelectedUser(user);
    setEditPassword('');setEditPasswordConfirm('');setShowEditPassword(false);
    setEditForm({
      displayName: user.displayName,
      position: user.position || '',
      role: user.role,
      status: user.status,
      assignedRegions: user.assignedRegions || [],
      assignedSchools: user.assignedSchools || []
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!selectedUser)return;
    if(editPassword&&(editPassword.length<12||!/\d/.test(editPassword)||!/[a-zA-Z]/.test(editPassword))){
      alert('Buat sandi minimal 12 karakter, mengandung huruf dan angka.');return;
    }
    if(editPassword!==editPasswordConfirm){
      alert('Konfirmasi sandi baru belum sama.');return;
    }
    setSubmitting(true);
    try{
      await authService.updateAuthorizedUser(selectedUser.uid,editForm);
      if(editPassword){
        try{await authService.createOrResetPassword(selectedUser.uid,editPassword);}
        catch(err){
          alert('Peran/hak akses sudah disimpan, tetapi reset sandi gagal: '+
            (err instanceof Error?err.message:'periksa layanan Auth'));
          return;
        }
      }
      setEditPassword('');setEditPasswordConfirm('');
      setEditModalOpen(false);
      await loadData();
      alert('Pengguna dan hak akses berhasil diperbarui.'+
        (editPassword?' Kata sandi baru telah ditetapkan. Berikan melalui saluran aman.':''));
    }catch(err:any){alert(err.message||'Gagal memperbarui pengguna');}
    finally{setSubmitting(false);}
  };

  const handleToggleDeactivate = async(user:UserProfile)=>{
    if(!isSuperAdmin||user.uid===currentUser?.uid)return;
    const next=user.status==='ACTIVE'?'INACTIVE':'ACTIVE';
    if(!confirm((next==='INACTIVE'?'Nonaktifkan':'Aktifkan')+' akses '+user.email+'?'))return;
    setSubmitting(true);
    try{
      await authService.adminAction({action:'setStatus',userId:user.uid,status:next});
      await loadData();
    }catch(err:any){alert(err.message||'Gagal mengubah status pengguna');}
    finally{setSubmitting(false);}
  };

  const handleRemoveUser=async(user:UserProfile)=>{
    if(!isSuperAdmin||user.uid===currentUser?.uid)return;
    if(!confirm('Hapus akses ARF One School untuk '+user.email+
      '? Pengguna akan hilang dari daftar ARF dan tidak bisa lagi mengakses aplikasi ini. Akun login di aplikasi lain tidak dihapus.'))return;
    setDeleting(user.uid);
    try{
      await authService.removeAuthorizedUser(user.uid);
      await loadData();
      alert('Pengguna berhasil dihapus dari keanggotaan ARF One School.');
    }catch(err:any){alert(err.message||'Gagal menghapus pengguna.');}
    finally{setDeleting(null);}
  };

  const filteredUsers = users.filter(u => {
    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.position || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-[#073b2d] font-bold text-xs mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Manajemen Pengguna &amp; Otorisasi Akun (RBAC)</span>
          </div>
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">
            Pengelolaan Akun &amp; Hak Akses Sekolah
          </h2>
          <p className="text-xs text-[#5f5d5d] mt-1">
            Super Administrator dapat menambahkan pengguna baru, menetapkan peran, serta membatasi akses pada wilayah dan sekolah tertentu.
          </p>
        </div>

        {isSuperAdmin && (
          <button
            onClick={openInviteModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-bold text-xs shadow-sm hover:bg-[#0a4f3d] transition-colors cursor-pointer shrink-0"
            style={{ backgroundColor: '#073b2d' }}
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Pengguna Baru</span>
          </button>
        )}
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama, email, jabatan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-gray-300 bg-white"
            />
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs py-2 px-3 rounded-lg border border-gray-300 bg-white text-gray-800"
          >
            <option value="ALL">Semua Peran (Roles)</option>
            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            <option value="FOUNDATION_MANAGER">FOUNDATION_MANAGER</option>
            <option value="REGIONAL_LEAD">REGIONAL_LEAD</option>
            <option value="SCHOOL_PRINCIPAL">SCHOOL_PRINCIPAL</option>
            <option value="SCHOOL_OPERATOR">SCHOOL_OPERATOR</option>
            <option value="HR_OFFICER">HR_OFFICER</option>
            <option value="ASSET_OFFICER">ASSET_OFFICER</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">
            Daftar Pengguna Terdaftar ({filteredUsers.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Nama &amp; Email Pengguna</th>
                <th className="py-3 px-4">Jabatan</th>
                <th className="py-3 px-4">Peran (Role)</th>
                <th className="py-3 px-4">Sekolah / Wilayah Ditugaskan</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map(user => {
                const isBootstrap = user.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

                return (
                  <tr key={user.uid} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-900 flex items-center gap-1.5">
                        <span>{user.displayName}</span>
                        {isBootstrap && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-[#c89b55]/20 text-[#c89b55] font-mono font-bold">
                            Bootstrap Admin
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#5f5d5d]">{user.email}</div>
                    </td>
                    <td className="py-3 px-4 text-gray-700">{user.position || '-'}</td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#073b2d]/10 text-[#073b2d]">
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {user.role === 'SUPER_ADMIN' || user.role === 'FOUNDATION_MANAGER' ? (
                        <span className="text-emerald-700 font-semibold">Semua Sekolah (Global)</span>
                      ) : (
                        <div className="text-[11px] text-gray-600">
                          {user.assignedSchools && user.assignedSchools.length > 0
                            ? user.assignedSchools.map(sid => {
                                const sch = schools.find(s => s.school_id === sid);
                                return sch?.school_name || sid;
                              }).join(', ')
                            : 'Belum ditugaskan'}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        user.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : user.status === 'INVITED'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openEditModal(user)}
                          disabled={submitting||Boolean(deleting)}
                          className="p-1 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900"
                          title="Ubah Hak Akses"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {!isBootstrap && (
                          <button
                            onClick={() => handleToggleDeactivate(user)}
                            className="p-1 rounded hover:bg-rose-50 text-gray-400 hover:text-rose-600"
                            title={user.status === 'ACTIVE' ? 'Nonaktifkan Akun' : user.status === 'INVITED' ? 'Setujui Pendaftaran Pengguna' : 'Aktifkan Akun'}
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {!isBootstrap&&user.uid!==currentUser?.uid&&isSuperAdmin&&(
                          <button type="button" disabled={Boolean(deleting)||submitting}
                            onClick={()=>void handleRemoveUser(user)}
                            className="p-1 rounded text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                            title="Hapus Pengguna dari ARF One School">
                            <Trash2 className="w-3.5 h-3.5"/>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">
                    Tidak ada pengguna ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Invitations Table */}
      {invitations.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">
              Daftar Undangan Akun / Pre-Otorisasi ({invitations.length})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Email Calon Pengguna</th>
                  <th className="py-3 px-4">Nama Lengkap</th>
                  <th className="py-3 px-4">Peran Diberikan</th>
                  <th className="py-3 px-4">Diundang Oleh</th>
                  <th className="py-3 px-4 text-center">Status Undangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invitations.map(inv => (
                  <tr key={inv.id} className="hover:bg-gray-50/80">
                    <td className="py-3 px-4 font-mono font-medium text-gray-900">{inv.email}</td>
                    <td className="py-3 px-4 text-gray-800">{inv.displayName}</td>
                    <td className="py-3 px-4 font-semibold text-[#073b2d]">{inv.role}</td>
                    <td className="py-3 px-4 text-gray-500">{inv.invitedBy}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        inv.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Add / Invite User */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-base font-bold text-gray-900 pb-3 border-b border-gray-200">
              Tambah Pengguna Baru &amp; Hak Akses (Buat Akun Login)
            </h3>

            <form onSubmit={handleInviteSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  value={inviteForm.displayName}
                  onChange={(e) => setInviteForm({ ...inviteForm, displayName: e.target.value })}
                  placeholder="Contoh: Rian Pratama, S.Kom."
                  className="w-full text-xs p-2.5 rounded-lg border border-gray-300"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Email Pengguna *</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="email.resmi@sumbermassarana.sch.id atau gmail.com"
                  className="w-full text-xs p-2.5 rounded-lg border border-gray-300"
                  required
                />
                <p className="text-[11px] text-[#5f5d5d] mt-1">Akun login dibuat menggunakan email dan kata sandi yang Anda tentukan. Berikan sandi hanya melalui saluran aman.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Jabatan Institusional</label>
                  <input
                    type="text"
                    value={inviteForm.position}
                    onChange={(e) => setInviteForm({ ...inviteForm, position: e.target.value })}
                    placeholder="Contoh: Kepala Sekolah, Operator Dapodik"
                    className="w-full text-xs p-2.5 rounded-lg border border-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Peran Pengguna (Role) *</label>
                  <select
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as UserRole })}
                    className="w-full text-xs p-2.5 rounded-lg border border-gray-300"
                    required
                  >
                    <option value="SUPER_ADMIN">SUPER_ADMIN (Akses Penuh)</option>
                    <option value="FOUNDATION_MANAGER">FOUNDATION_MANAGER (Eksekutif)</option>
                    <option value="REGIONAL_LEAD">REGIONAL_LEAD (Koordinator Wilayah)</option>
                    <option value="SCHOOL_PRINCIPAL">SCHOOL_PRINCIPAL (Kepala Sekolah)</option>
                    <option value="SCHOOL_OPERATOR">SCHOOL_OPERATOR (Operator Sekolah)</option>
                    <option value="HR_OFFICER">HR_OFFICER (Staf HR &amp; PTK)</option>
                    <option value="ASSET_OFFICER">ASSET_OFFICER (Staf Sarpras &amp; Aset)</option>
                  </select>
                </div>
              </div>

              <div className="rounded-xl border border-[#c89b55]/50 bg-[#f6f3ec] p-3 space-y-3">
                <p className="flex items-center gap-2 text-xs font-bold text-[#073b2d]"><KeyRound className="w-4 h-4"/> Buat Sandi Pengguna *</p>
                <p className="text-[11px] text-gray-600">Sandi minimal 12 karakter (huruf dan angka). Tidak disimpan pada profil ARF dan tidak dikirim otomatis melalui email.</p>
                <label className="block text-xs font-semibold">Kata Sandi Baru
                  <div className="mt-1 flex gap-2">
                    <input type={showCreatePassword?'text':'password'} autoComplete="new-password"
                      value={createPassword} onChange={e=>setCreatePassword(e.target.value)}
                      minLength={12} required className="min-w-0 flex-1 rounded-lg border border-gray-300 p-2.5 text-xs"/>
                    <button type="button" onClick={()=>setShowCreatePassword(v=>!v)}
                      aria-label={showCreatePassword?'Sembunyikan sandi':'Tampilkan sandi'}
                      className="rounded-lg border border-gray-300 p-2">
                      {showCreatePassword?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}
                    </button>
                  </div>
                </label>
                <label className="block text-xs font-semibold">Konfirmasi Kata Sandi
                  <input type="password" autoComplete="new-password" value={createPasswordConfirm}
                    onChange={e=>setCreatePasswordConfirm(e.target.value)} minLength={12} required
                    className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-xs"/>
                </label>
              </div>
              {/* School Assignment Checklist */}
              {inviteForm.role !== 'SUPER_ADMIN' && inviteForm.role !== 'FOUNDATION_MANAGER' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Sekolah yang Ditugaskan (Otorisasi Akses)
                  </label>
                  <div className="border border-gray-200 rounded-lg p-3 max-h-36 overflow-y-auto space-y-1.5 bg-gray-50/50">
                    {schools.map(sch => {
                      const checked = inviteForm.assignedSchools.includes(sch.school_id);
                      return (
                        <label key={sch.school_id} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setInviteForm(prev => ({ ...prev, assignedSchools: [...prev.assignedSchools, sch.school_id] }));
                              } else {
                                setInviteForm(prev => ({ ...prev, assignedSchools: prev.assignedSchools.filter(id => id !== sch.school_id) }));
                              }
                            }}
                            className="rounded text-[#073b2d]"
                          />
                          <span>{sch.school_name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg text-white font-semibold text-xs shadow-sm"
                  style={{ backgroundColor: '#073b2d' }}
                >
                  {submitting ? 'Memproses...' : 'Simpan &amp; Otorisasi Pengguna'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit User */}
      {editModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-base font-bold text-gray-900 pb-3 border-b border-gray-200">
              Ubah Peran &amp; Kewenangan Pengguna
            </h3>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Email Pengguna</label>
                <input
                  type="text"
                  disabled
                  value={selectedUser.email}
                  className="w-full text-xs p-2.5 rounded-lg border border-gray-300 bg-gray-50 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Jabatan</label>
                  <input
                    type="text"
                    value={editForm.position}
                    onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Peran (Role) *</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                    className="w-full text-xs p-2.5 rounded-lg border border-gray-300"
                    required
                  >
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                    <option value="FOUNDATION_MANAGER">FOUNDATION_MANAGER</option>
                    <option value="REGIONAL_LEAD">REGIONAL_LEAD</option>
                    <option value="SCHOOL_PRINCIPAL">SCHOOL_PRINCIPAL</option>
                    <option value="SCHOOL_OPERATOR">SCHOOL_OPERATOR</option>
                    <option value="HR_OFFICER">HR_OFFICER</option>
                    <option value="ASSET_OFFICER">ASSET_OFFICER</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Status Akun</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as UserStatus })}
                  className="w-full text-xs p-2.5 rounded-lg border border-gray-300"
                >
                  <option value="ACTIVE">ACTIVE (Aktif)</option>
                  <option value="INACTIVE">INACTIVE (Dinonaktifkan)</option>
                  <option value="INVITED">INVITED (Menunggu)</option>
                </select>
              </div>

              <div className="rounded-xl border border-[#c89b55]/50 bg-[#f6f3ec] p-3 space-y-3">
                <p className="flex items-center gap-2 text-xs font-bold text-[#073b2d]"><KeyRound className="w-4 h-4"/> Buat / Reset Sandi Pengguna</p>
                <p className="text-[11px] text-gray-600">
                  Opsional. Kosongkan untuk mempertahankan sandi sebelumnya. Untuk reset, buat sandi baru minimal 12 karakter (huruf dan angka).
                  Perubahan sandi pada layanan Supabase Auth berlaku bagi akun email yang sama.
                </p>
                <label className="block text-xs font-semibold">Sandi Baru
                  <div className="mt-1 flex gap-2">
                    <input type={showEditPassword?'text':'password'} value={editPassword}
                      onChange={e=>setEditPassword(e.target.value)} autoComplete="new-password"
                      minLength={12} className="min-w-0 flex-1 rounded-lg border border-gray-300 p-2.5 text-xs"/>
                    <button type="button" aria-label={showEditPassword?'Sembunyikan sandi':'Tampilkan sandi'}
                      onClick={()=>setShowEditPassword(v=>!v)} className="rounded-lg border border-gray-300 p-2">
                      {showEditPassword?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}
                    </button>
                  </div>
                </label>
                <label className="block text-xs font-semibold">Konfirmasi Sandi Baru
                  <input type="password" value={editPasswordConfirm} autoComplete="new-password"
                    onChange={e=>setEditPasswordConfirm(e.target.value)} minLength={editPassword?12:undefined}
                    required={Boolean(editPassword)} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-xs"/>
                </label>
              </div>
              {/* School Assignment Checklist */}
              {editForm.role !== 'SUPER_ADMIN' && editForm.role !== 'FOUNDATION_MANAGER' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Sekolah yang Ditugaskan
                  </label>
                  <div className="border border-gray-200 rounded-lg p-3 max-h-36 overflow-y-auto space-y-1.5 bg-gray-50/50">
                    {schools.map(sch => {
                      const checked = editForm.assignedSchools.includes(sch.school_id);
                      return (
                        <label key={sch.school_id} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditForm(prev => ({ ...prev, assignedSchools: [...prev.assignedSchools, sch.school_id] }));
                              } else {
                                setEditForm(prev => ({ ...prev, assignedSchools: prev.assignedSchools.filter(id => id !== sch.school_id) }));
                              }
                            }}
                            className="rounded text-[#073b2d]"
                          />
                          <span>{sch.school_name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg text-white font-semibold text-xs shadow-sm"
                  style={{ backgroundColor: '#073b2d' }}
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
