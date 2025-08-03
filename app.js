/* 0) SUPABASE CONFIG */
    const SUPABASE_URL = 'https://mfbdfhvqnxuhxwscdffv.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mYmRmaHZxbnh1aHh3c2NkZmZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwNDE3MjIsImV4cCI6MjA2OTYxNzcyMn0.rV15XLuKNXR05uEXOunzCkPoPGAVNKrzMP4iffw-vxk';
    const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    /* 1) STATE */
    let currentUser = { email: null, role: 'user' };
    let users = [], projects = [], clients = [], contracts = [], tasks = [], weeklyReports = [];
    let lastError = null;

    /* Helpers */
    const pad = (n,w)=> (n+'').padStart(w,'0');
    function getWeekNumber(date=new Date()){ 
      const d=new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())); 
      const dayNum=d.getUTCDay()||7; 
      d.setUTCDate(d.getUTCDate()+4-dayNum); 
      const yearStart=new Date(Date.UTC(d.getUTCFullYear(),0,1)); 
      return Math.ceil((((d-yearStart)/86400000)+1)/7); 
    }
    function money(n){ return (n||0).toLocaleString('vi-VN'); }

    function generateClientId(){ 
      const used=clients.map(c=>parseInt((c.id||'').slice(1),10)).filter(Number.isFinite); 
      for(let i=1;i<10000;i++) if(!used.includes(i)) return 'C'+pad(i,4); 
      throw new Error('Hết mã khách hàng'); 
    }
    
    function generateProjectId(){ 
      const y=new Date().getFullYear().toString().slice(-2); 
      const used=projects.filter(p=>(p.project_id||'').startsWith('P_'+y)).map(p=>parseInt(p.project_id.slice(4),10)).filter(Number.isFinite); 
      for(let i=1;i<1000;i++) if(!used.includes(i)) return 'P_'+y+pad(i,3); 
      throw new Error('Hết mã dự án'); 
    }
    
    function generateContractId(){ 
      const now=new Date(); 
      const y=now.getFullYear().toString().slice(-2); 
      const w=pad(getWeekNumber(now),2); 
      const used=contracts.filter(c=>(c.contract_id||'').startsWith(`HD_${y}${w}`)).map(c=>parseInt(c.contract_id.slice(7),10)).filter(Number.isFinite); 
      for(let i=1;i<=99;i++) if(!used.includes(i)) return `HD_${y}${w}${pad(i,2)}`; 
      throw new Error('Hết mã hợp đồng'); 
    }

    function generateTaskId(){ 
      const used=tasks.map(t=>parseInt((t.task_id||'').slice(1),10)).filter(Number.isFinite); 
      for(let i=1;i<100000;i++) if(!used.includes(i)) return 'T'+pad(i,5); 
      throw new Error('Hết mã task'); 
    }

    function showSection(page){ 
      document.querySelectorAll('[id^="page-"]').forEach(el=>el.classList.add('d-none')); 
      const targetPage = document.getElementById(`page-${page}`);
      if (targetPage) {
        targetPage.classList.remove('d-none'); 
      }
      document.querySelectorAll('.sidebar .nav-link').forEach(a=>{ 
        if(a.dataset.page===page) a.classList.add('active'); 
        else a.classList.remove('active'); 
      }); 
    }

    function setKPIs(){ 
      document.getElementById('kpiUsers').textContent = users.length;
      document.getElementById('kpiProjects').textContent = projects.length;
      document.getElementById('kpiClients').textContent = clients.length;
      document.getElementById('kpiTasks').textContent = tasks.length;
      
      // Task status counts
      const pendingTasks = tasks.filter(t => t.status === 'pending').length;
      const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
      const completedTasks = tasks.filter(t => t.status === 'completed').length;
      
      document.getElementById('kpiTasksPending').textContent = pendingTasks;
      document.getElementById('kpiTasksInProgress').textContent = inProgressTasks;
      document.getElementById('kpiTasksCompleted').textContent = completedTasks;
      
      // Project status counts
      const activeProjects = projects.filter(p => p.status === 'active').length;
      const onHoldProjects = projects.filter(p => p.status === 'on_hold').length;
      const completedProjects = projects.filter(p => p.status === 'completed').length;
      
      document.getElementById('kpiProjectsActive').textContent = activeProjects;
      document.getElementById('kpiProjectsOnHold').textContent = onHoldProjects;
      document.getElementById('kpiProjectsCompleted').textContent = completedProjects;
    }

    function updateUserTaskSummary() {
      const myTasks = tasks.filter(t => t.assigned_user === currentUser.email);
      const pending = myTasks.filter(t => t.status === 'pending').length;
      const inProgress = myTasks.filter(t => t.status === 'in_progress').length;
      const completed = myTasks.filter(t => t.status === 'completed').length;
      
      document.getElementById('myTasksPending').textContent = pending;
      document.getElementById('myTasksInProgress').textContent = inProgress;
      document.getElementById('myTasksCompleted').textContent = completed;
      
      renderMyTasks();
    }

    function renderMyTasks() {
      const tbody = document.getElementById('myTasksTbody');
      if (!tbody) return;
      
      const myTasks = tasks.filter(t => t.assigned_user === currentUser.email);
      
      tbody.innerHTML = myTasks.map(task => {
        const project = projects.find(p => p.project_id === task.project_id);
        const progress = task.total_hours > 0 ? Math.round((task.completed_hours / task.total_hours) * 100) : 0;
        const statusClass = task.status === 'pending' ? 'status-pending' : 
                           task.status === 'in_progress' ? 'status-in-progress' : 'status-completed';
        
        return `
          <tr>
            <td>${task.task_name || 'N/A'}</td>
            <td>${project ? project.project_name : 'N/A'}</td>
            <td>${task.deadline || 'N/A'}</td>
            <td><span class="status-badge ${statusClass}">${task.status || 'N/A'}</span></td>
            <td>
              <div class="progress" style="height: 20px;">
                <div class="progress-bar" role="progressbar" style="width: ${progress}%" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100">${progress}%</div>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    function renderProjectSummary() {
      const tbody = document.getElementById('projectSummaryTbody');
      if (!tbody) return;
      
      tbody.innerHTML = projects.map(project => {
        const client = clients.find(c => c.id === project.customer_id);
        const projectTasks = tasks.filter(t => t.project_id === project.project_id);
        const totalTasks = projectTasks.length;
        const completedTasks = projectTasks.filter(t => t.status === 'completed').length;
        const inProgressTasks = projectTasks.filter(t => t.status === 'in_progress').length;
        const pendingTasks = projectTasks.filter(t => t.status === 'pending').length;
        const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        
        return `
          <tr>
            <td>${project.project_name || 'N/A'}</td>
            <td>${client ? client.name : 'N/A'}</td>
            <td>${totalTasks}</td>
            <td>${completedTasks}</td>
            <td>${inProgressTasks}</td>
            <td>${pendingTasks}</td>
            <td>
              <div class="progress" style="height: 20px;">
                <div class="progress-bar" role="progressbar" style="width: ${progress}%" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100">${progress}%</div>
              </div>
            </td>
            <td><span class="status-badge ${project.status === 'active' ? 'status-in-progress' : project.status === 'completed' ? 'status-completed' : 'status-pending'}">${project.status || 'N/A'}</span></td>
          </tr>
        `;
      }).join('');
    }

    /* 2) AUTH (copied verbatim from index(1).html 2025-08-01) */

    // Wrapper so legacy code (loadData, renderAllTables) still works with index-style auth
    async function loadAll(){ await loadData(); }
    function renderAll(){ renderAllTables(); }

    // ===== AUTH HELPERS =====
    function showAuthOverlay(msg=''){
      const el = document.getElementById('authOverlay');
      if(msg) document.getElementById('authError').textContent = msg;
      el.classList.remove('d-none');
    }
    function hideAuthOverlay(){
      document.getElementById('authError').textContent = '';
      document.getElementById('authOverlay').classList.add('d-none');
    }

    function applyRoleUI(){
      // In PMS, chỉ admin/manager mới xem Project Summary
      const isElev = ['admin','manager','BOM'].includes(currentUser.role);
      const navPS = document.getElementById('navProjectSummary');
      if(navPS) navPS.style.display = isElev ? '' : 'none';
    }

    async function enforceAuth(){
      try{
        const { data:{ user } } = await sb.auth.getUser();
        if(!user){ showAuthOverlay(); return; }
        const { data: prof, error } = await sb
          .from('user_profiles')
          .select('role, active')
          .eq('email', user.email)
          .single();
        if(error || !prof || !prof.active){
          showAuthOverlay('email đăng nhập không thuộc hệ thống VSEC; hãy liên hệ admin');
          await sb.auth.signOut();
          return;
        }
        currentUser = { email: user.email, role: (prof.role || 'user') };
        document.getElementById('currentEmail').textContent = currentUser.email;
        hideAuthOverlay();

        await loadAll();
        applyRoleUI();
        renderAll();
        showSection('dashboard');
      }catch(e){
        console.error(e);
        showAuthOverlay('Không thể xác thực. Vui lòng thử lại.');
      }
    }

    // Google OAuth Sign‑in
    document.addEventListener('click', (e)=>{
      if(e.target && e.target.id === 'btnGoogle'){
        sb.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.href }
        });
      }
    });

    // Sign‑out button
    document.getElementById('btnSignOut').onclick = async (e)=>{
      e.preventDefault();
      await sb.auth.signOut();
      location.reload();
    };

    sb.auth.onAuthStateChange((_event, _session)=>{ enforceAuth(); });

    /* 3) DATA LOADING */
    async function loadData() {
      try {
        const [usersRes, projectsRes, clientsRes, contractsRes, tasksRes, reportsRes] = await Promise.all([
          sb.from('user_profiles').select('*'),
          sb.from('projects').select('*'),
          sb.from('customers').select('*'),
          sb.from('contracts').select('*'),
          sb.from('tasks').select('*'),
          sb.from('weekly_reports').select('*')
        ]);

        // Check for errors and handle them
        if (usersRes.error) {
          console.error('Error loading users:', usersRes.error);
          lastError = usersRes.error;
        }
        if (projectsRes.error) {
          console.error('Error loading projects:', projectsRes.error);
          lastError = projectsRes.error;
        }
        if (clientsRes.error) {
          console.error('Error loading clients:', clientsRes.error);
          lastError = clientsRes.error;
        }
        if (contractsRes.error) {
          console.error('Error loading contracts:', contractsRes.error);
          lastError = contractsRes.error;
        }
        if (tasksRes.error) {
          console.error('Error loading tasks:', tasksRes.error);
          lastError = tasksRes.error;
        }
        if (reportsRes.error) {
          console.error('Error loading reports:', reportsRes.error);
          lastError = reportsRes.error;
        }

        users = usersRes.data || [];
        projects = projectsRes.data || [];
        clients = clientsRes.data || [];
        contracts = contractsRes.data || [];
        tasks = tasksRes.data || [];
        weeklyReports = reportsRes.data || [];

        console.log('--- loadData result ---', {
          users: users.length, 
          projects: projects.length, 
          tasks: tasks.length, 
          weeklyReports: weeklyReports.length, 
          clients: clients.length, 
          contracts: contracts.length
        });

        setKPIs();
        updateUserTaskSummary();
        renderProjectSummary();
        renderAllTables();
      } catch (error) {
        console.error('Error in loadData:', error);
        lastError = error;
      }
    }

    function renderAllTables() {
      renderUsers();
      renderProjects();
      renderClients();
      renderContracts();
      renderTasks();
      renderWeeklyReports();
    }

    /* 4) RENDER FUNCTIONS */
    function renderUsers() {
      const tbody = document.getElementById('userTbody');
      if (!tbody) return;
      
      tbody.innerHTML = users.map(user => `
        <tr>
          <td>${user.email || 'N/A'}</td>
          <td>${user.role || 'N/A'}</td>
          <td>${user.active ? '<span class="badge bg-success">Active</span>' : '<span class="badge bg-secondary">Inactive</span>'}</td>
          <td>
            <button class="btn btn-sm btn-outline-primary" onclick="editUser('${user.email}')">Edit</button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${user.email}')">Delete</button>
          </td>
        </tr>
      `).join('');
    }

    function renderProjects() {
      const tbody = document.getElementById('projectTbody');
      if (!tbody) return;
      
      tbody.innerHTML = projects.map(project => {
        const client = clients.find(c => c.id === project.customer_id);
        return `
          <tr>
            <td>${project.project_id || 'N/A'}</td>
            <td>${project.project_name || 'N/A'}</td>
            <td>${client ? client.name : 'N/A'}</td>
            <td>${project.start_date || 'N/A'}</td>
            <td>${project.end_date || 'N/A'}</td>
            <td><span class="status-badge ${project.status === 'active' ? 'status-in-progress' : project.status === 'completed' ? 'status-completed' : 'status-pending'}">${project.status || 'N/A'}</span></td>
            <td>
              <button class="btn btn-sm btn-outline-primary" onclick="editProject('${project.project_id}')">Edit</button>
              <button class="btn btn-sm btn-outline-danger" onclick="deleteProject('${project.project_id}')">Delete</button>
            </td>
          </tr>
        `;
      }).join('');
    }

    function renderClients() {
      const tbody = document.getElementById('clientTbody');
      if (!tbody) return;
      
      tbody.innerHTML = clients.map(client => `
        <tr>
          <td>${client.id || 'N/A'}</td>
          <td>${client.name || 'N/A'}</td>
          <td>${client.contact_person || 'N/A'}</td>
          <td>${client.phone || 'N/A'}</td>
          <td>${client.email || 'N/A'}</td>
          <td>${client.tax_code || 'N/A'}</td>
          <td>
            <button class="btn btn-sm btn-outline-primary" onclick="editClient('${client.id}')">Edit</button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteClient('${client.id}')">Delete</button>
          </td>
        </tr>
      `).join('');
    }

    function renderContracts() {
      const tbody = document.getElementById('contractTbody');
      if (!tbody) return;
      
      tbody.innerHTML = contracts.map(contract => {
        const project = projects.find(p => p.project_id === contract.project_id);
        const client = clients.find(c => c.id === contract.customer_id);
        return `
          <tr>
            <td>${contract.contract_id || 'N/A'}</td>
            <td>${project ? project.project_name : 'N/A'}</td>
            <td>${client ? client.name : 'N/A'}</td>
            <td>${money(contract.value || 0)}</td>
            <td><span class="status-badge ${contract.status === 'active' ? 'status-in-progress' : contract.status === 'completed' ? 'status-completed' : 'status-pending'}">${contract.status || 'N/A'}</span></td>
            <td>
              <button class="btn btn-sm btn-outline-primary" onclick="editContract('${contract.contract_id}')">Edit</button>
              <button class="btn btn-sm btn-outline-danger" onclick="deleteContract('${contract.contract_id}')">Delete</button>
            </td>
          </tr>
        `;
      }).join('');
    }

    function renderTasks() {
      const tbody = document.getElementById('taskTbody');
      if (!tbody) return;
      
      tbody.innerHTML = tasks.map(task => {
        const project = projects.find(p => p.project_id === task.project_id);
        const statusClass = task.status === 'pending' ? 'status-pending' : 
                           task.status === 'in_progress' ? 'status-in-progress' : 'status-completed';
        return `
          <tr>
            <td>${task.task_id || 'N/A'}</td>
            <td>${task.task_name || 'N/A'}</td>
            <td>${project ? project.project_name : 'N/A'}</td>
            <td>${task.assigned_user || 'N/A'}</td>
            <td>${task.total_hours || 0}</td>
            <td>${task.completed_hours || 0}</td>
            <td><span class="status-badge ${statusClass}">${task.status || 'N/A'}</span></td>
            <td>${task.deadline || 'N/A'}</td>
            <td>
              <button class="btn btn-sm btn-outline-primary" onclick="editTask('${task.task_id}')">Edit</button>
              <button class="btn btn-sm btn-outline-danger" onclick="deleteTask('${task.task_id}')">Delete</button>
            </td>
          </tr>
        `;
      }).join('');
    }

    function renderWeeklyReports() {
      const tbody = document.getElementById('weeklyReportTbody');
      if (!tbody) return;
      
      tbody.innerHTML = weeklyReports.map(report => `
        <tr>
          <td>${report.week_year || 'N/A'}</td>
          <td>${report.user_email || 'N/A'}</td>
          <td>${report.completed_tasks || 0}</td>
          <td>${report.total_hours || 0}</td>
          <td>${report.suggestions || 'N/A'}</td>
          <td>${report.created_at ? new Date(report.created_at).toLocaleDateString('vi-VN') : 'N/A'}</td>
          <td>
            <button class="btn btn-sm btn-outline-primary" onclick="viewWeeklyReport('${report.id}')">View</button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteWeeklyReport('${report.id}')">Delete</button>
          </td>
        </tr>
      `).join('');
    }

    /* 5) FORM FUNCTIONS */
    function showUserForm(user = null) {
      const isEdit = !!user;
      const formHtml = `
        <div class="card card-shadow mb-4">
          <div class="card-body">
            <h5 class="card-title">${isEdit ? 'Sửa' : 'Thêm'} User</h5>
            <form id="userForm">
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label">Email</label>
                  <input type="email" class="form-control" name="email" value="${user?.email || ''}" ${isEdit ? 'readonly' : ''} required>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Role</label>
                  <select class="form-select" name="role" required>
                    <option value="user" ${user?.role === 'user' ? 'selected' : ''}>User</option>
                    <option value="manager" ${user?.role === 'manager' ? 'selected' : ''}>Manager</option>
                    <option value="admin" ${user?.role === 'admin' ? 'selected' : ''}>Admin</option>
                  </select>
                </div>
                <div class="col-md-6">
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" name="active" ${user?.active ? 'checked' : ''}>
                    <label class="form-check-label">Active</label>
                  </div>
                </div>
              </div>
              <div class="mt-3">
                <button type="submit" class="btn btn-primary">${isEdit ? 'Cập nhật' : 'Thêm'}</button>
                <button type="button" class="btn btn-secondary" onclick="hideUserForm()">Hủy</button>
              </div>
            </form>
          </div>
        </div>
      `;
      
      document.getElementById('userFormWrap').innerHTML = formHtml;
      document.getElementById('userFormWrap').classList.remove('d-none');
      
      document.getElementById('userForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const userData = {
          email: formData.get('email'),
          role: formData.get('role'),
          active: formData.has('active')
        };
        
        try {
          if (isEdit) {
            const { error } = await sb.from('user_profiles').update(userData).eq('email', user.email);
            if (error) throw error;
          } else {
            const { error } = await sb.from('user_profiles').insert(userData);
            if (error) throw error;
          }
          hideUserForm();
          await loadData();
        } catch (error) {
          console.error('Error saving user:', error);
          alert('Lỗi: ' + error.message);
        }
      });
    }

    function hideUserForm() {
      document.getElementById('userFormWrap').classList.add('d-none');
    }

    function showProjectForm(project = null) {
      const isEdit = !!project;
      const formHtml = `
        <div class="card card-shadow mb-4">
          <div class="card-body">
            <h5 class="card-title">${isEdit ? 'Sửa' : 'Thêm'} Dự án</h5>
            <form id="projectForm">
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label">Tên dự án</label>
                  <input type="text" class="form-control" name="project_name" value="${project?.project_name || ''}" required>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Khách hàng</label>
                  <select class="form-select" name="customer_id" required>
                    <option value="">Chọn khách hàng</option>
                    ${clients.map(c => 
                      `<option value="${c.id}" ${project?.customer_id === c.id ? 'selected' : ''}>${c.name}</option>`
                    ).join('')}
                  </select>
                </div>
                <div class="col-md-12">
                  <label class="form-label">Mô tả</label>
                  <textarea class="form-control" name="description" rows="3">${project?.description || ''}</textarea>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Ngày bắt đầu</label>
                  <input type="date" class="form-control" name="start_date" value="${project?.start_date || ''}">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Ngày kết thúc</label>
                  <input type="date" class="form-control" name="end_date" value="${project?.end_date || ''}">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Trạng thái</label>
                  <select class="form-select" name="status" required>
                    <option value="active" ${project?.status === 'active' ? 'selected' : ''}>Active</option>
                    <option value="on_hold" ${project?.status === 'on_hold' ? 'selected' : ''}>On Hold</option>
                    <option value="completed" ${project?.status === 'completed' ? 'selected' : ''}>Completed</option>
                  </select>
                </div>
              </div>
              <div class="mt-3">
                <button type="submit" class="btn btn-primary">${isEdit ? 'Cập nhật' : 'Thêm'}</button>
                <button type="button" class="btn btn-secondary" onclick="hideProjectForm()">Hủy</button>
              </div>
            </form>
          </div>
        </div>
      `;
      
      document.getElementById('projectFormWrap').innerHTML = formHtml;
      document.getElementById('projectFormWrap').classList.remove('d-none');
      
      document.getElementById('projectForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const projectData = {
          project_name: formData.get('project_name'),
          customer_id: formData.get('customer_id'),
          description: formData.get('description'),
          start_date: formData.get('start_date') || null,
          end_date: formData.get('end_date') || null,
          status: formData.get('status')
        };
        
        try {
          if (isEdit) {
            const { error } = await sb.from('projects').update(projectData).eq('project_id', project.project_id);
            if (error) throw error;
          } else {
            projectData.project_id = generateProjectId();
            const { error } = await sb.from('projects').insert(projectData);
            if (error) throw error;
          }
          hideProjectForm();
          await loadData();
        } catch (error) {
          console.error('Error saving project:', error);
          alert('Lỗi: ' + error.message);
        }
      });
    }

    function hideProjectForm() {
      document.getElementById('projectFormWrap').classList.add('d-none');
    }

    function showClientForm(client = null) {
      const isEdit = !!client;
      const formHtml = `
        <div class="card card-shadow mb-4">
          <div class="card-body">
            <h5 class="card-title">${isEdit ? 'Sửa' : 'Thêm'} Khách hàng</h5>
            <form id="clientForm">
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label">Tên khách hàng</label>
                  <input type="text" class="form-control" name="name" value="${client?.name || ''}" required>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Người liên hệ</label>
                  <input type="text" class="form-control" name="contact_person" value="${client?.contact_person || ''}">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Số điện thoại</label>
                  <input type="tel" class="form-control" name="phone" value="${client?.phone || ''}">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Email</label>
                  <input type="email" class="form-control" name="email" value="${client?.email || ''}">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Mã số thuế</label>
                  <input type="text" class="form-control" name="tax_code" value="${client?.tax_code || ''}">
                </div>
                <div class="col-md-12">
                  <label class="form-label">Địa chỉ</label>
                  <textarea class="form-control" name="address" rows="3">${client?.address || ''}</textarea>
                </div>
              </div>
              <div class="mt-3">
                <button type="submit" class="btn btn-primary">${isEdit ? 'Cập nhật' : 'Thêm'}</button>
                <button type="button" class="btn btn-secondary" onclick="hideClientForm()">Hủy</button>
              </div>
            </form>
          </div>
        </div>
      `;
      
      document.getElementById('clientFormWrap').innerHTML = formHtml;
      document.getElementById('clientFormWrap').classList.remove('d-none');
      
      document.getElementById('clientForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const clientData = {
          name: formData.get('name'),
          contact_person: formData.get('contact_person'),
          phone: formData.get('phone'),
          email: formData.get('email'),
          tax_code: formData.get('tax_code'),
          address: formData.get('address')
        };
        
        try {
          if (isEdit) {
            const { error } = await sb.from('customers').update(clientData).eq('id', client.id);
            if (error) throw error;
          } else {
            clientData.id = generateClientId();
            const { error } = await sb.from('customers').insert(clientData);
            if (error) throw error;
          }
          hideClientForm();
          await loadData();
        } catch (error) {
          console.error('Error saving client:', error);
          alert('Lỗi: ' + error.message);
        }
      });
    }

    function hideClientForm() {
      document.getElementById('clientFormWrap').classList.add('d-none');
    }

    function showContractForm(contract = null) {
      const isEdit = !!contract;
      const formHtml = `
        <div class="card card-shadow mb-4">
          <div class="card-body">
            <h5 class="card-title">${isEdit ? 'Sửa' : 'Thêm'} Hợp đồng</h5>
            <form id="contractForm">
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label">Dự án</label>
                  <select class="form-select" name="project_id" required>
                    <option value="">Chọn dự án</option>
                    ${projects.map(p => 
                      `<option value="${p.project_id}" ${contract?.project_id === p.project_id ? 'selected' : ''}>${p.project_name}</option>`
                    ).join('')}
                  </select>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Khách hàng</label>
                  <select class="form-select" name="customer_id" required>
                    <option value="">Chọn khách hàng</option>
                    ${clients.map(c => 
                      `<option value="${c.id}" ${contract?.customer_id === c.id ? 'selected' : ''}>${c.name}</option>`
                    ).join('')}
                  </select>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Giá trị hợp đồng</label>
                  <input type="number" class="form-control" name="value" value="${contract?.value || ''}" min="0" step="1000">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Trạng thái</label>
                  <select class="form-select" name="status" required>
                    <option value="draft" ${contract?.status === 'draft' ? 'selected' : ''}>Draft</option>
                    <option value="active" ${contract?.status === 'active' ? 'selected' : ''}>Active</option>
                    <option value="completed" ${contract?.status === 'completed' ? 'selected' : ''}>Completed</option>
                  </select>
                </div>
                <div class="col-md-12">
                  <label class="form-label">Ghi chú</label>
                  <textarea class="form-control" name="notes" rows="3">${contract?.notes || ''}</textarea>
                </div>
              </div>
              <div class="mt-3">
                <button type="submit" class="btn btn-primary">${isEdit ? 'Cập nhật' : 'Thêm'}</button>
                <button type="button" class="btn btn-secondary" onclick="hideContractForm()">Hủy</button>
              </div>
            </form>
          </div>
        </div>
      `;
      
      document.getElementById('contractFormWrap').innerHTML = formHtml;
      document.getElementById('contractFormWrap').classList.remove('d-none');
      
      document.getElementById('contractForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const contractData = {
          project_id: formData.get('project_id'),
          customer_id: formData.get('customer_id'),
          value: parseFloat(formData.get('value')) || 0,
          status: formData.get('status'),
          notes: formData.get('notes')
        };
        
        try {
          if (isEdit) {
            const { error } = await sb.from('contracts').update(contractData).eq('contract_id', contract.contract_id);
            if (error) throw error;
          } else {
            contractData.contract_id = generateContractId();
            const { error } = await sb.from('contracts').insert(contractData);
            if (error) throw error;
          }
          hideContractForm();
          await loadData();
        } catch (error) {
          console.error('Error saving contract:', error);
          alert('Lỗi: ' + error.message);
        }
      });
    }

    function hideContractForm() {
      document.getElementById('contractFormWrap').classList.add('d-none');
    }

    function showTaskForm(task = null) {
      const isEdit = !!task;
      const formHtml = `
        <div class="card card-shadow mb-4">
          <div class="card-body">
            <h5 class="card-title">${isEdit ? 'Sửa' : 'Thêm'} Task</h5>
            <form id="taskForm">
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label">Tên Task</label>
                  <input type="text" class="form-control" name="task_name" value="${task?.task_name || ''}" required>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Dự án</label>
                  <div class="position-relative">
                    <input type="text" class="form-control" name="project_search" id="projectSearch" 
                           value="${task ? projects.find(p => p.project_id === task.project_id)?.project_name || '' : ''}" 
                           placeholder="Tìm kiếm dự án..." autocomplete="off">
                    <input type="hidden" name="project_id" id="selectedProjectId" value="${task?.project_id || ''}">
                    <div id="projectSuggestions" class="suggestions d-none"></div>
                  </div>
                </div>
                <div class="col-md-12">
                  <label class="form-label">Mô tả</label>
                  <textarea class="form-control" name="description" rows="3">${task?.description || ''}</textarea>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Người thực hiện</label>
                  <select class="form-select" name="assigned_user" required>
                    <option value="">Chọn người thực hiện</option>
                    ${users.filter(u => u.active).map(u => 
                      `<option value="${u.email}" ${task?.assigned_user === u.email ? 'selected' : ''}>${u.email}</option>`
                    ).join('')}
                  </select>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Tổng thời gian (giờ)</label>
                  <input type="number" class="form-control" name="total_hours" value="${task?.total_hours || ''}" min="0" step="0.5">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Thời gian đã thực hiện (giờ)</label>
                  <input type="number" class="form-control" name="completed_hours" value="${task?.completed_hours || 0}" min="0" step="0.5">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Tình trạng</label>
                  <select class="form-select" name="status" required>
                    <option value="pending" ${task?.status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="in_progress" ${task?.status === 'in_progress' ? 'selected' : ''}>Đang thực hiện</option>
                    <option value="completed" ${task?.status === 'completed' ? 'selected' : ''}>Đã hoàn thành</option>
                  </select>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Deadline</label>
                  <input type="date" class="form-control" name="deadline" value="${task?.deadline || ''}">
                </div>
              </div>
              <div class="mt-3">
                <button type="submit" class="btn btn-primary">${isEdit ? 'Cập nhật' : 'Thêm'}</button>
                <button type="button" class="btn btn-secondary" onclick="hideTaskForm()">Hủy</button>
              </div>
            </form>
          </div>
        </div>
      `;
      
      document.getElementById('taskFormWrap').innerHTML = formHtml;
      document.getElementById('taskFormWrap').classList.remove('d-none');
      
      // Setup project autofill
      setupProjectAutofill();
      
      document.getElementById('taskForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const taskData = {
          task_name: formData.get('task_name'),
          project_id: formData.get('project_id'),
          description: formData.get('description'),
          assigned_user: formData.get('assigned_user'),
          total_hours: parseFloat(formData.get('total_hours')) || 0,
          completed_hours: parseFloat(formData.get('completed_hours')) || 0,
          status: formData.get('status'),
          deadline: formData.get('deadline') || null
        };
        
        if (!taskData.project_id) {
          alert('Vui lòng chọn dự án');
          return;
        }
        
        try {
          if (isEdit) {
            const { error } = await sb.from('tasks').update(taskData).eq('task_id', task.task_id);
            if (error) throw error;
          } else {
            taskData.task_id = generateTaskId();
            const { error } = await sb.from('tasks').insert(taskData);
            if (error) throw error;
          }
          hideTaskForm();
          await loadData();
        } catch (error) {
          console.error('Error saving task:', error);
          alert('Lỗi: ' + error.message);
        }
      });
    }

    function setupProjectAutofill() {
      const searchInput = document.getElementById('projectSearch');
      const suggestionsDiv = document.getElementById('projectSuggestions');
      const hiddenInput = document.getElementById('selectedProjectId');
      
      if (!searchInput || !suggestionsDiv || !hiddenInput) return;
      
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if (query.length < 1) {
          suggestionsDiv.classList.add('d-none');
          return;
        }
        
        const matches = projects.filter(p => 
          (p.project_name && p.project_name.toLowerCase().includes(query)) || 
          (p.project_id && p.project_id.toLowerCase().includes(query))
        );
        
        if (matches.length > 0) {
          suggestionsDiv.innerHTML = matches.map(p => 
            `<div class="suggestion-item" data-id="${p.project_id}" data-name="${p.project_name}">
              ${p.project_name} (${p.project_id})
            </div>`
          ).join('');
          suggestionsDiv.classList.remove('d-none');
        } else {
          suggestionsDiv.classList.add('d-none');
        }
      });
      
      suggestionsDiv.addEventListener('click', (e) => {
        if (e.target.classList.contains('suggestion-item')) {
          const projectId = e.target.dataset.id;
          const projectName = e.target.dataset.name;
          searchInput.value = projectName;
          hiddenInput.value = projectId;
          suggestionsDiv.classList.add('d-none');
        }
      });
      
      document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !suggestionsDiv.contains(e.target)) {
          suggestionsDiv.classList.add('d-none');
        }
      });
    }

    function hideTaskForm() {
      document.getElementById('taskFormWrap').classList.add('d-none');
    }

    function showWeeklyReportForm() {
      const currentWeek = getWeekNumber();
      const currentYear = new Date().getFullYear();
      const weekYear = `${currentYear}-W${pad(currentWeek, 2)}`;
      
      // Get user's tasks for current week
      const userTasks = tasks.filter(t => t.assigned_user === currentUser.email);
      
      const formHtml = `
        <div class="card card-shadow mb-4">
          <div class="card-body">
            <h5 class="card-title">Tạo báo cáo tuần ${weekYear}</h5>
            <form id="weeklyReportForm">
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label">Tuần</label>
                  <input type="text" class="form-control" name="week_year" value="${weekYear}" readonly>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Người báo cáo</label>
                  <input type="text" class="form-control" name="user_email" value="${currentUser.email}" readonly>
                </div>
                <div class="col-md-12">
                  <label class="form-label">Tasks đã hoàn thành trong tuần</label>
                  <div class="border rounded p-3" style="max-height: 200px; overflow-y: auto;">
                    ${userTasks.map(task => {
                      const project = projects.find(p => p.project_id === task.project_id);
                      return `
                        <div class="form-check">
                          <input class="form-check-input" type="checkbox" name="completed_task_ids" value="${task.task_id}" id="task_${task.task_id}">
                          <label class="form-check-label" for="task_${task.task_id}">
                            ${task.task_name} - ${project ? project.project_name : 'N/A'}
                          </label>
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Tổng thời gian thực hiện (giờ)</label>
                  <input type="number" class="form-control" name="total_hours" min="0" step="0.5" required>
                </div>
                <div class="col-md-12">
                  <label class="form-label">Đề xuất kiến nghị</label>
                  <textarea class="form-control" name="suggestions" rows="4" placeholder="Nhập đề xuất, kiến nghị cho tuần tiếp theo..."></textarea>
                </div>
              </div>
              <div class="mt-3">
                <button type="submit" class="btn btn-primary">Tạo báo cáo</button>
                <button type="button" class="btn btn-secondary" onclick="hideWeeklyReportForm()">Hủy</button>
              </div>
            </form>
          </div>
        </div>
      `;
      
      document.getElementById('weeklyReportFormWrap').innerHTML = formHtml;
      document.getElementById('weeklyReportFormWrap').classList.remove('d-none');
      
      document.getElementById('weeklyReportForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const completedTaskIds = formData.getAll('completed_task_ids');
        
        const reportData = {
          week_year: formData.get('week_year'),
          user_email: formData.get('user_email'),
          completed_tasks: completedTaskIds.length,
          completed_task_ids: completedTaskIds,
          total_hours: parseFloat(formData.get('total_hours')),
          suggestions: formData.get('suggestions'),
          created_at: new Date().toISOString()
        };
        
        try {
          const { error } = await sb.from('weekly_reports').insert(reportData);
          if (error) throw error;
          hideWeeklyReportForm();
          await loadData();
          alert('Báo cáo đã được tạo thành công!');
        } catch (error) {
          console.error('Error creating weekly report:', error);
          alert('Lỗi: ' + error.message);
        }
      });
    }

    function hideWeeklyReportForm() {
      document.getElementById('weeklyReportFormWrap').classList.add('d-none');
    }

    /* 6) CRUD FUNCTIONS */
    async function editUser(email) {
      const user = users.find(u => u.email === email);
      if (user) showUserForm(user);
    }

    async function deleteUser(email) {
      if (confirm('Bạn có chắc muốn xóa user này?')) {
        try {
          const { error } = await sb.from('user_profiles').delete().eq('email', email);
          if (error) throw error;
          await loadData();
        } catch (error) {
          console.error('Error deleting user:', error);
          alert('Lỗi: ' + error.message);
        }
      }
    }

    async function editProject(projectId) {
      const project = projects.find(p => p.project_id === projectId);
      if (project) showProjectForm(project);
    }

    async function deleteProject(projectId) {
      if (confirm('Bạn có chắc muốn xóa dự án này?')) {
        try {
          const { error } = await sb.from('projects').delete().eq('project_id', projectId);
          if (error) throw error;
          await loadData();
        } catch (error) {
          console.error('Error deleting project:', error);
          alert('Lỗi: ' + error.message);
        }
      }
    }

    async function editClient(clientId) {
      const client = clients.find(c => c.id === clientId);
      if (client) showClientForm(client);
    }

    async function deleteClient(clientId) {
      if (confirm('Bạn có chắc muốn xóa khách hàng này?')) {
        try {
          const { error } = await sb.from('customers').delete().eq('id', clientId);
          if (error) throw error;
          await loadData();
        } catch (error) {
          console.error('Error deleting client:', error);
          alert('Lỗi: ' + error.message);
        }
      }
    }

    async function editContract(contractId) {
      const contract = contracts.find(c => c.contract_id === contractId);
      if (contract) showContractForm(contract);
    }

    async function deleteContract(contractId) {
      if (confirm('Bạn có chắc muốn xóa hợp đồng này?')) {
        try {
          const { error } = await sb.from('contracts').delete().eq('contract_id', contractId);
          if (error) throw error;
          await loadData();
        } catch (error) {
          console.error('Error deleting contract:', error);
          alert('Lỗi: ' + error.message);
        }
      }
    }

    async function editTask(taskId) {
      const task = tasks.find(t => t.task_id === taskId);
      if (task) showTaskForm(task);
    }

    async function deleteTask(taskId) {
      if (confirm('Bạn có chắc muốn xóa task này?')) {
        try {
          const { error } = await sb.from('tasks').delete().eq('task_id', taskId);
          if (error) throw error;
          await loadData();
        } catch (error) {
          console.error('Error deleting task:', error);
          alert('Lỗi: ' + error.message);
        }
      }
    }

    async function deleteWeeklyReport(reportId) {
      if (confirm('Bạn có chắc muốn xóa báo cáo này?')) {
        try {
          const { error } = await sb.from('weekly_reports').delete().eq('id', reportId);
          if (error) throw error;
          await loadData();
        } catch (error) {
          console.error('Error deleting weekly report:', error);
          alert('Lỗi: ' + error.message);
        }
      }
    }

    function viewWeeklyReport(reportId) {
      const report = weeklyReports.find(r => r.id === reportId);
      if (report) {
        const completedTaskNames = report.completed_task_ids?.map(taskId => {
          const task = tasks.find(t => t.task_id === taskId);
          return task ? task.task_name : taskId;
        }).join(', ') || 'Không có';
        
        alert(`Báo cáo tuần ${report.week_year}
Người báo cáo: ${report.user_email}
Tasks hoàn thành: ${completedTaskNames}
Tổng thời gian: ${report.total_hours} giờ
Đề xuất: ${report.suggestions || 'Không có'}`);
      }
    }

    /* 7) EVENT LISTENERS */
    document.addEventListener('DOMContentLoaded', function() {
      // Navigation
      document.getElementById('sidebarNav').addEventListener('click', (e) => {
        if (e.target.dataset.page) {
          e.preventDefault();
          showSection(e.target.dataset.page);
        }
      });

      // Add buttons
      document.getElementById('btnAddUser').addEventListener('click', () => showUserForm());
      document.getElementById('btnAddProject').addEventListener('click', () => showProjectForm());
      document.getElementById('btnAddClient').addEventListener('click', () => showClientForm());
      document.getElementById('btnAddContract').addEventListener('click', () => showContractForm());
      document.getElementById('btnAddTask').addEventListener('click', () => showTaskForm());
      document.getElementById('btnAddWeeklyReport').addEventListener('click', () => showWeeklyReportForm());
    });

    // Initialize auth check on page load
    window.addEventListener('load', () => {
      enforceAuth();
    });