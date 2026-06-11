const { createClient } = require('@supabase/supabase-js');

const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6YmxtYmFobm95bnRyaGlzdGVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODgwMDQyOCwiZXhwIjoyMDk0Mzc2NDI4fQ.CUd9-WlYKWXKJPhqQiExjqELXYMkuzIviHO8GnQGqpk";
const adminSupabase = createClient("https://pzblmbahnoyntrhistea.supabase.co", supabaseServiceKey);

async function run() {
  const { data: users, error } = await adminSupabase.auth.admin.listUsers({ perPage: 1000 });
  
  if (error) {
    console.error("Error fetching users:", error);
    return;
  }

  const { data: profiles } = await adminSupabase.from('profiles').select('id, full_name, email');
  const profileMap = {};
  if (profiles) {
      for (const p of profiles) {
          profileMap[p.id] = p.full_name || p.email;
      }
  }

  const loggedInUsers = users.users
    .filter(u => u.last_sign_in_at)
    .sort((a, b) => new Date(b.last_sign_in_at) - new Date(a.last_sign_in_at))
    .map(u => ({
        id: u.id,
        email: u.email,
        name: profileMap[u.id] || 'Desconocido',
        lastLogin: new Date(u.last_sign_in_at).toLocaleString('es-CL', { timeZone: 'America/Santiago' })
    }));

  console.log(`=== USUARIOS QUE HAN INICIADO SESIÓN ===\n`);
  if (loggedInUsers.length === 0) {
      console.log("Nadie ha iniciado sesión aún.");
  } else {
      loggedInUsers.forEach((u, i) => {
          console.log(`${i + 1}. ${u.name} (${u.email}) - Último acceso: ${u.lastLogin}`);
      });
  }
}

run();
