-- Fuente: nomina base.xlsx e info judicial.xlsx entregados para DSAL.
-- La informacion judicial queda protegida y solo se expone mediante RPC de revision autenticada.

create table if not exists public.recruitment_dsal_roster (
  national_id text primary key,
  first_name text not null,
  last_name text not null,
  second_last_name text not null,
  source_name text not null default 'nomina base.xlsx',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.recruitment_dsal_judicial_summary (
  national_id text primary key,
  criminal_count integer not null default 0 check (criminal_count >= 0),
  labor_count integer not null default 0 check (labor_count >= 0),
  source_name text not null,
  imported_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.recruitment_dsal_judicial_causes (
  id uuid primary key default gen_random_uuid(),
  national_id text not null,
  category text not null check (category in ('criminal', 'laboral')),
  description text not null,
  cause_date date,
  case_reference text,
  court text,
  source_name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (national_id, category, description, cause_date, case_reference)
);

create index if not exists idx_recruitment_dsal_judicial_causes_lookup
  on public.recruitment_dsal_judicial_causes (national_id, category, cause_date);

alter table public.recruitment_dsal_roster enable row level security;
alter table public.recruitment_dsal_judicial_summary enable row level security;
alter table public.recruitment_dsal_judicial_causes enable row level security;

drop policy if exists recruitment_dsal_roster_no_direct_access on public.recruitment_dsal_roster;
create policy recruitment_dsal_roster_no_direct_access on public.recruitment_dsal_roster for all using (false) with check (false);
drop policy if exists recruitment_dsal_judicial_summary_no_direct_access on public.recruitment_dsal_judicial_summary;
create policy recruitment_dsal_judicial_summary_no_direct_access on public.recruitment_dsal_judicial_summary for all using (false) with check (false);
drop policy if exists recruitment_dsal_judicial_causes_no_direct_access on public.recruitment_dsal_judicial_causes;
create policy recruitment_dsal_judicial_causes_no_direct_access on public.recruitment_dsal_judicial_causes for all using (false) with check (false);

revoke all on table public.recruitment_dsal_roster from public, anon, authenticated;
revoke all on table public.recruitment_dsal_judicial_summary from public, anon, authenticated;
revoke all on table public.recruitment_dsal_judicial_causes from public, anon, authenticated;

insert into public.recruitment_dsal_roster (national_id, first_name, last_name, second_last_name) values
  ('90230336', 'Eliana Iris', 'Veliz', 'Soto'),
  ('76805768', 'Aaron Arsenio', 'Cortes', 'Carvajal'),
  ('131147651', 'Aaron Moises', 'Maripil', 'Pincheira'),
  ('102854306', 'Adrian Arturo', 'Rodriguez', 'Toro'),
  ('105596065', 'Alejandro Marcelo', 'Reyes', 'Herrera'),
  ('84455652', 'Alex Alejandro', 'Ramirez', 'Collao'),
  ('178199560', 'Aliro Andres', 'Monrroy', 'Monrroy'),
  ('13359485K', 'Ariel Bernardo', 'Araya', 'Toro'),
  ('14153324K', 'Arnaldo Félix', 'Videla', 'Cortez'),
  ('94343682', 'Arturo Fernando', 'Avalos', 'Gonzalez'),
  ('164081753', 'Camilo Santiago Eslabin', 'Silva', 'Pinto'),
  ('127235163', 'Carlos Andres', 'Paredes', 'Cornejo'),
  ('131196873', 'Carlos Esteban', 'Molina', 'Manzanares'),
  ('174445737', 'Carlos Manuel', 'Pincheira', 'Salinas'),
  ('130656854', 'Carlos Roberto', 'Nunez', 'Nilo'),
  ('103298997', 'Cesar Alfredo', 'Cofre', 'Salas'),
  ('88866908', 'Christian Alberto', 'Ulloa', 'Villablanca'),
  ('12452248K', 'Christian Alexis', 'Flores', 'Gallardo'),
  ('83979739', 'Cirilo Antonio', 'Soto', 'Parra'),
  ('129528257', 'Claudio Del Carmen', 'Barraza', 'Calderon'),
  ('130059538', 'Claudio Patricio', 'Garcia', 'Gallardo'),
  ('129394064', 'Cristian Antonio', 'Araya', 'Tapia'),
  ('117238024', 'Cristian Eduardo', 'Puelles', 'Ramos'),
  ('120799940', 'Daniel Fernando', 'Canales', 'Marambio'),
  ('82573364', 'David Eduardo Patricio', 'Perez', 'Alarcon'),
  ('87841367', 'David Leonidas', 'Lineros', 'Mascareño'),
  ('93220161', 'Edgardo Walterio', 'Tabilo', 'Munoz'),
  ('115104284', 'Eduard Hernan', 'Leyton', 'Araya'),
  ('140897779', 'Elias Daniel', 'Bravo', 'Pasten'),
  ('150584531', 'Elio Ismael', 'Pizarro', 'Barrera'),
  ('132816239', 'Enrique Antonio', 'San Martín', 'Olivares'),
  ('79452122', 'Erasmo Del Carmen', 'Saldivar', 'Correa'),
  ('129495200', 'Esteban Alberto', 'Bravo', 'Valencia'),
  ('126112157', 'Fabian Alexander', 'Solis', 'Halles'),
  ('131484372', 'Fabian Octavio', 'Pérez', 'Salamaca'),
  ('129494492', 'Favián Marcell', 'Escudero', 'Guardia'),
  ('123490827', 'Fernando Enrique', 'Carvajal', 'Salinas'),
  ('128461922', 'Fernando Ismael', 'Robles', 'Sanchez'),
  ('14370582K', 'Francisco Antonio', 'Ramos', 'Ramos'),
  ('11321886K', 'Francisco Ivan', 'Sandoval', 'Mardones'),
  ('142399059', 'Francisco Octavio', 'Carrasco', 'Ceballo'),
  ('152329660', 'German Enrique', 'Colicheo', 'Cheuquepan'),
  ('84519553', 'Gilberto Eduardo', 'Gonzalez', 'Vargas'),
  ('94341612', 'Gilberto Manuel', 'Celis', 'Barrera'),
  ('140992348', 'Gonzalo Antonio', 'Villalobos', 'Albornoz'),
  ('150289548', 'Guillermo Andres', 'Pizarro', 'Avila'),
  ('156120510', 'Gustavo Adolfo', 'Cortes', 'Leon'),
  ('258807855', 'Henry Edson', 'Ramos', 'Artica'),
  ('89598583', 'Hernán Eduardo', 'Mardones', 'Quezada'),
  ('91726467', 'Hugo Rosendo', 'Vega', 'Vasquez'),
  ('140145483', 'Ignacio Esteban', 'Perez', 'Verches'),
  ('99280611', 'Ivan Alex', 'Astudillo', 'Rojas'),
  ('81113807', 'Jacinto Antonio', 'Salvo', 'Carrasco'),
  ('145709121', 'Jaime Andres', 'Ferrada', 'Cisternas'),
  ('88416856', 'Jaime Del Rosario', 'Barrera', 'Alvarez'),
  ('120992392', 'Javier Alejandro', 'Arancibia', 'Carrasco'),
  ('155726024', 'Javier Andres', 'Galleguillos', 'Rojas'),
  ('99754583', 'Jessica Del Carmen', 'Méndez', 'Vásquez'),
  ('153207089', 'Joan Gabriel', 'Robles', 'Ernani'),
  ('117932737', 'John Osiel', 'Torres', 'Briones'),
  ('160892862', 'Jonathan Andrés', 'Morales', 'Provoste'),
  ('175452230', 'Jonathan Luis', 'Godoy', 'Trullen'),
  ('123470974', 'Jorge Andres', 'Godoy', 'Martinez'),
  ('119319099', 'Jorge Arturo', 'Carmona', 'Vega'),
  ('144126750', 'Jorge Ernesto', 'Diaz', 'Arancibia'),
  ('116360209', 'Jose Alberto', 'Sandoval', 'Ruiz'),
  ('138270017', 'Jose Alejandro', 'Rojas', 'Rojas'),
  ('262121399', 'Jose Antonio', 'Castellano', 'Angola'),
  ('133697608', 'Jose Daniel', 'Diaz', 'Aviles'),
  ('128032576', 'Jose Luis', 'Arancibia', 'Araya'),
  ('117929302', 'Jose Renato', 'Morales', 'Morales'),
  ('134514876', 'Juan Andres', 'Zuñiga', 'Cornejo'),
  ('95722717', 'Juan Antonio', 'Arroyo', 'Castro'),
  ('121572869', 'Juan Antonio', 'Cornejo', 'Valdés'),
  ('90427679', 'Juan Carlos', 'Diaz', 'Palma'),
  ('145343321', 'Juan Carlos', 'Saavedra', 'Farias'),
  ('108594675', 'Juan Miguel', 'Fonseca', 'Zuñiga'),
  ('99262206', 'Lautaro Del Carmen', 'Alfaro', 'Borquez'),
  ('87527387', 'Leoncio Martin', 'Ortega', 'Quezada'),
  ('135324531', 'Leopoldo Francisco', 'Iriarte', 'Iriarte')
on conflict (national_id) do update set first_name = excluded.first_name, last_name = excluded.last_name, second_last_name = excluded.second_last_name;

insert into public.recruitment_dsal_roster (national_id, first_name, last_name, second_last_name) values
  ('98516778', 'Luis Alberto', 'Araya', 'Mondaca'),
  ('143109488', 'Luis Alberto', 'Duran', 'Rojas'),
  ('12939420K', 'Luis Alberto', 'Tapia', 'Soto'),
  ('161102024', 'Luis Alejandro', 'Cortés', 'Cortés'),
  ('116304090', 'Luis Carlos', 'Castillo', 'Claveria'),
  ('125701140', 'Luis Eduardo', 'Muñoz', 'Arcos'),
  ('160403594', 'Luis Esteban', 'Sandoval', 'Argudin'),
  ('91953668', 'Luis Mauricio', 'Carrasco', 'Hernandez'),
  ('99969873', 'Luis Omar', 'Rojas', 'Gutierrez'),
  ('106423563', 'Marcelo Alejandro', 'Reyes', 'Fuentes'),
  ('88523245', 'Marcelo Antonio', 'Lotito', 'Gonzalez'),
  ('177621870', 'Marco Antonio', 'Cobs', 'Astudillo'),
  ('150376971', 'Mario Andrés Maximiliano', 'Galleguillos', 'Ahumada'),
  ('97804834', 'Mario Enrique', 'Pizarro', 'Palacios'),
  ('98052828', 'Mauricio Antonio', 'Rivas', 'Palacios'),
  ('143762432', 'Mauricio Carlos', 'Bastías', 'García'),
  ('88060180', 'Mauricio Javier', 'Ardiles', 'Rios'),
  ('139122658', 'Michel Angelo', 'Leiva', 'Becerra'),
  ('139762789', 'Miguel Angel', 'Campusano', 'Vega'),
  ('105153511', 'Miguel Ernesto Gonzalo', 'Escobar', 'Rivera'),
  ('125962092', 'Millan Alberto', 'Jimenez', 'Plaza'),
  ('98005102', 'Nancio Antonio', 'Contreras', 'Jorquera'),
  ('135201154', 'Nelly Zunilde', 'Miranda', 'Del Río'),
  ('103871093', 'Nelson Eugenio', 'Vasquez', 'Miranda'),
  ('121824396', 'Nelson Gabriel', 'Lopez', 'Flores'),
  ('130665322', 'Pablo Fernando', 'Meza', 'Pizarro'),
  ('119138787', 'Patricio Hernan', 'Fuentealba', 'Pedrero'),
  ('104066321', 'Patricio Ricardo', 'Paredes', 'Vielma'),
  ('126515669', 'Paulo Antonio', 'Rosales', 'Santana'),
  ('18895300K', 'Pedro Galvarino', 'Gutierrez', 'Urzua'),
  ('108239719', 'Pedro Ivan', 'Perez', 'Aravena'),
  ('12012000K', 'Pedro Nolasco', 'Olivares', 'Tapia'),
  ('112606130', 'Pedro Orlando', 'Flores', 'Cortes'),
  ('11619077K', 'Ramiro Antonio', 'Gonzalez', 'Olivares'),
  ('144043243', 'Raul Alejandro', 'Balboa', 'Iturra'),
  ('143154564', 'Raul Eduardo', 'Martinez', 'Navia'),
  ('109671053', 'Raúl Enrique', 'Sánchez', 'Morales'),
  ('89220025', 'Raul Jaime', 'Alvarez', 'Troillet'),
  ('107918450', 'Remigio Ulises', 'Lemus', 'Lemus'),
  ('125019951', 'Rene Yunel', 'Leiva', 'Hamed'),
  ('167638775', 'Ricardo Antonio', 'Rivera', 'Zúñiga'),
  ('77973141', 'Ricardo Enrique', 'Bernales', 'Galleguillos'),
  ('88887212', 'Ricardo Eustaquio', 'Lopez', 'Baeza'),
  ('145278589', 'Roberto Carlos', 'Araya', 'Uribe'),
  ('157250159', 'Roberto Moises', 'Fuentes', 'Saez'),
  ('138990761', 'Rodrigo Alfonso', 'Leiva', 'Osorio'),
  ('11877311K', 'Rodrigo Juan Luis', 'Pinto', 'Rivera'),
  ('171204232', 'Rodrigo Michel', 'Hidalgo', 'Flores'),
  ('169810281', 'Rolando Fabiani', 'Martínez', 'Huera'),
  ('145189470', 'Ronald Boris', 'Rojas', 'Urra'),
  ('134792353', 'Simon Maximiliano', 'Escobar', 'Yanez'),
  ('9956329K', 'Vicente Julián', 'Godoy', 'Díaz'),
  ('151424791', 'Victor Alejandro', 'Garcia', 'Avaca'),
  ('70954567', 'Victor Hugo', 'Alvarez', 'Mardones'),
  ('14447421K', 'Victor Raúl', 'Osorio', 'Ponce'),
  ('116290014', 'Walter Maximiliano', 'Rivas', 'Silva'),
  ('102416201', 'Wilfredo', 'Valdivia', 'Castillo'),
  ('155731087', 'William Eric', 'Araya', 'Toro'),
  ('109904503', 'Wilson Antonio', 'Rivera', 'Ibacache'),
  ('112041699', 'Yair Eduardo', 'Geraldo', 'Carvajal'),
  ('112598022', 'Yerko Bernardo', 'Leyton', 'Araya'),
  ('122379817', 'Joaquin Felipe', 'Riquelme', 'Manriquez'),
  ('133311211', 'Carlos Adán', 'Carvajal', 'Herrera'),
  ('138805336', 'Elvis Alex', 'Poulin', 'Guerrero'),
  ('10119776K', 'Heriberto Enrique', 'Espinoza', 'Liguen'),
  ('15096394K', 'Humberto Jorge', 'Artigas', 'Inzunza'),
  ('112429778', 'Ildefonso Carlos', 'Pezoa', 'Gutierrez'),
  ('100145219', 'Luis Francisco', 'Lopez', 'Flores'),
  ('122840778', 'Manuel Marcelo', 'Valdes', 'Jofre'),
  ('104622135', 'Mario Antonio', 'Pena', 'Rivera'),
  ('152559348', 'Oscar Enrique', 'Valencia', 'Catricura'),
  ('111625166', 'Pedro Humberto', 'Barraza', 'Urqueta'),
  ('115075756', 'Ricardo Alfredo', 'Perez', 'Cortes'),
  ('137051788', 'Valentin Andres', 'Salinas', 'Velasquez'),
  ('11665038K', 'Wilson Ricardo', 'Toro', 'Soto'),
  ('109864250', 'Yerko Alfonso', 'Corrotea', 'Rojas')
on conflict (national_id) do update set first_name = excluded.first_name, last_name = excluded.last_name, second_last_name = excluded.second_last_name;

insert into public.recruitment_dsal_judicial_summary (national_id, criminal_count, labor_count, source_name) values
  ('116471094', 1, 0, 'info judicial.xlsx'),
  ('79426938', 1, 0, 'info judicial.xlsx'),
  ('161102024', 4, 0, 'info judicial.xlsx'),
  ('184036991', 1, 0, 'info judicial.xlsx'),
  ('103871093', 0, 0, 'info judicial.xlsx'),
  ('125701140', 0, 0, 'info judicial.xlsx'),
  ('143154564', 3, 1, 'info judicial.xlsx'),
  ('119319099', 0, 0, 'info judicial.xlsx'),
  ('105596065', 0, 1, 'info judicial.xlsx'),
  ('90427679', 1, 0, 'info judicial.xlsx'),
  ('14447421K', 0, 0, 'info judicial.xlsx'),
  ('127235163', 5, 0, 'info judicial.xlsx'),
  ('131196873', 0, 2, 'info judicial.xlsx'),
  ('145343321', 2, 4, 'info judicial.xlsx'),
  ('179304678', 1, 0, 'info judicial.xlsx'),
  ('195593167', 0, 0, 'info judicial.xlsx'),
  ('139122658', 0, 0, 'info judicial.xlsx'),
  ('150288924', 0, 0, 'info judicial.xlsx'),
  ('115104284', 0, 0, 'info judicial.xlsx'),
  ('134514876', 0, 0, 'info judicial.xlsx'),
  ('144484592', 0, 0, 'info judicial.xlsx'),
  ('129495200', 1, 0, 'info judicial.xlsx'),
  ('128032576', 0, 0, 'info judicial.xlsx'),
  ('13359485K', 0, 0, 'info judicial.xlsx'),
  ('104622135', 0, 0, 'info judicial.xlsx'),
  ('111625166', 0, 0, 'info judicial.xlsx'),
  ('119138787', 0, 0, 'info judicial.xlsx'),
  ('174445737', 0, 0, 'info judicial.xlsx'),
  ('138805336', 0, 0, 'info judicial.xlsx'),
  ('105153511', 0, 0, 'info judicial.xlsx'),
  ('155731087', 0, 0, 'info judicial.xlsx'),
  ('155726024', 0, 0, 'info judicial.xlsx'),
  ('116304090', 1, 0, 'info judicial.xlsx'),
  ('182605689', 0, 0, 'info judicial.xlsx'),
  ('112606130', 0, 0, 'info judicial.xlsx'),
  ('198732605', 0, 0, 'info judicial.xlsx'),
  ('26891496K', 0, 0, 'info judicial.xlsx'),
  ('120992392', 2, 0, 'info judicial.xlsx'),
  ('109904503', 0, 0, 'info judicial.xlsx'),
  ('103298997', 0, 0, 'info judicial.xlsx'),
  ('150584531', 0, 1, 'info judicial.xlsx'),
  ('150376971', 2, 0, 'info judicial.xlsx'),
  ('167638775', 0, 0, 'info judicial.xlsx'),
  ('121572869', 0, 1, 'info judicial.xlsx'),
  ('143762432', 1, 0, 'info judicial.xlsx'),
  ('129494492', 0, 0, 'info judicial.xlsx'),
  ('134792353', 0, 0, 'info judicial.xlsx'),
  ('153207089', 1, 0, 'info judicial.xlsx'),
  ('129528257', 0, 0, 'info judicial.xlsx'),
  ('83979739', 1, 0, 'info judicial.xlsx'),
  ('99280611', 0, 0, 'info judicial.xlsx'),
  ('143109488', 0, 0, 'info judicial.xlsx'),
  ('12939420K', 0, 0, 'info judicial.xlsx'),
  ('263346114', 1, 0, 'info judicial.xlsx'),
  ('135201154', 0, 0, 'info judicial.xlsx'),
  ('145709121', 0, 2, 'info judicial.xlsx'),
  ('82573364', 0, 0, 'info judicial.xlsx'),
  ('88060180', 0, 0, 'info judicial.xlsx'),
  ('81113807', 0, 0, 'info judicial.xlsx'),
  ('117932737', 0, 1, 'info judicial.xlsx'),
  ('132816239', 2, 0, 'info judicial.xlsx'),
  ('14153324K', 0, 0, 'info judicial.xlsx'),
  ('131147651', 0, 0, 'info judicial.xlsx'),
  ('140992348', 3, 2, 'info judicial.xlsx'),
  ('121824396', 0, 0, 'info judicial.xlsx'),
  ('18895300K', 0, 0, 'info judicial.xlsx'),
  ('106423563', 0, 1, 'info judicial.xlsx'),
  ('138990761', 0, 0, 'info judicial.xlsx'),
  ('179882728', 0, 0, 'info judicial.xlsx'),
  ('112598022', 2, 0, 'info judicial.xlsx'),
  ('152559348', 0, 0, 'info judicial.xlsx'),
  ('133697608', 0, 0, 'info judicial.xlsx'),
  ('133311211', 6, 1, 'info judicial.xlsx'),
  ('14370582K', 0, 0, 'info judicial.xlsx'),
  ('186768205', 0, 0, 'info judicial.xlsx'),
  ('102416201', 0, 0, 'info judicial.xlsx'),
  ('170382080', 1, 0, 'info judicial.xlsx'),
  ('175452230', 2, 1, 'info judicial.xlsx'),
  ('161747130', 0, 0, 'info judicial.xlsx'),
  ('103898684', 0, 0, 'info judicial.xlsx')
on conflict (national_id) do update set criminal_count = excluded.criminal_count, labor_count = excluded.labor_count, source_name = excluded.source_name;

insert into public.recruitment_dsal_judicial_summary (national_id, criminal_count, labor_count, source_name) values
  ('141518615', 0, 0, 'info judicial.xlsx'),
  ('112041699', 0, 2, 'info judicial.xlsx'),
  ('126112157', 1, 0, 'info judicial.xlsx'),
  ('129394064', 2, 0, 'info judicial.xlsx'),
  ('12012000K', 0, 0, 'info judicial.xlsx'),
  ('123470974', 0, 0, 'info judicial.xlsx'),
  ('151424791', 0, 1, 'info judicial.xlsx'),
  ('116290014', 0, 0, 'info judicial.xlsx'),
  ('112429778', 0, 0, 'info judicial.xlsx'),
  ('166640458', 1, 0, 'info judicial.xlsx'),
  ('150289548', 0, 0, 'info judicial.xlsx'),
  ('104066321', 0, 0, 'info judicial.xlsx'),
  ('145189470', 0, 3, 'info judicial.xlsx'),
  ('120062042', 0, 0, 'info judicial.xlsx'),
  ('90230336', 0, 0, 'info judicial.xlsx'),
  ('115075756', 0, 0, 'info judicial.xlsx'),
  ('164081753', 0, 0, 'info judicial.xlsx'),
  ('135324531', 0, 0, 'info judicial.xlsx'),
  ('88523245', 0, 0, 'info judicial.xlsx'),
  ('102854306', 0, 0, 'info judicial.xlsx'),
  ('84519553', 0, 0, 'info judicial.xlsx'),
  ('98005102', 0, 0, 'info judicial.xlsx'),
  ('88866908', 0, 0, 'info judicial.xlsx'),
  ('99754583', 0, 0, 'info judicial.xlsx'),
  ('98052828', 0, 1, 'info judicial.xlsx'),
  ('94341612', 1, 2, 'info judicial.xlsx'),
  ('11877311K', 2, 0, 'info judicial.xlsx'),
  ('171204232', 0, 0, 'info judicial.xlsx'),
  ('87841367', 0, 0, 'info judicial.xlsx'),
  ('138270017', 3, 0, 'info judicial.xlsx'),
  ('157250159', 0, 0, 'info judicial.xlsx'),
  ('140897779', 0, 0, 'info judicial.xlsx'),
  ('156120510', 0, 0, 'info judicial.xlsx'),
  ('99262206', 0, 4, 'info judicial.xlsx'),
  ('117238024', 1, 0, 'info judicial.xlsx'),
  ('252317848', 0, 0, 'info judicial.xlsx'),
  ('105038321', 0, 3, 'info judicial.xlsx'),
  ('144931432', 0, 2, 'info judicial.xlsx'),
  ('99969873', 1, 0, 'info judicial.xlsx'),
  ('139762789', 2, 0, 'info judicial.xlsx'),
  ('130656854', 0, 0, 'info judicial.xlsx'),
  ('107918450', 0, 0, 'info judicial.xlsx'),
  ('88416856', 0, 0, 'info judicial.xlsx'),
  ('109671053', 0, 0, 'info judicial.xlsx'),
  ('144126750', 0, 0, 'info judicial.xlsx'),
  ('126515669', 2, 0, 'info judicial.xlsx'),
  ('142399059', 2, 0, 'info judicial.xlsx'),
  ('137051788', 0, 0, 'info judicial.xlsx'),
  ('9956329K', 0, 0, 'info judicial.xlsx'),
  ('89598583', 0, 0, 'info judicial.xlsx'),
  ('64030469', 1, 0, 'info judicial.xlsx'),
  ('93220161', 0, 0, 'info judicial.xlsx'),
  ('11321886K', 0, 0, 'info judicial.xlsx'),
  ('10160702K', 0, 0, 'info judicial.xlsx'),
  ('108594675', 0, 1, 'info judicial.xlsx'),
  ('116360209', 0, 0, 'info judicial.xlsx'),
  ('63909858', 0, 0, 'info judicial.xlsx'),
  ('84455652', 0, 0, 'info judicial.xlsx'),
  ('12262143K', 0, 0, 'info judicial.xlsx'),
  ('160403594', 2, 0, 'info judicial.xlsx'),
  ('108239719', 0, 1, 'info judicial.xlsx'),
  ('120799940', 0, 0, 'info judicial.xlsx'),
  ('130665322', 0, 0, 'info judicial.xlsx'),
  ('177621870', 0, 0, 'info judicial.xlsx'),
  ('130059538', 0, 0, 'info judicial.xlsx'),
  ('89220025', 0, 0, 'info judicial.xlsx'),
  ('145278589', 0, 0, 'info judicial.xlsx'),
  ('185091082', 0, 0, 'info judicial.xlsx'),
  ('262121399', 0, 0, 'info judicial.xlsx'),
  ('139775619', 0, 0, 'info judicial.xlsx'),
  ('94343682', 0, 0, 'info judicial.xlsx'),
  ('140145483', 0, 0, 'info judicial.xlsx'),
  ('125019951', 0, 0, 'info judicial.xlsx'),
  ('79452122', 0, 0, 'info judicial.xlsx'),
  ('109864250', 0, 0, 'info judicial.xlsx'),
  ('172040780', 0, 0, 'info judicial.xlsx'),
  ('192714184', 0, 0, 'info judicial.xlsx'),
  ('11665038K', 0, 0, 'info judicial.xlsx'),
  ('88887212', 0, 0, 'info judicial.xlsx'),
  ('159759148', 0, 0, 'info judicial.xlsx')
on conflict (national_id) do update set criminal_count = excluded.criminal_count, labor_count = excluded.labor_count, source_name = excluded.source_name;

insert into public.recruitment_dsal_judicial_summary (national_id, criminal_count, labor_count, source_name) values
  ('91953668', 0, 0, 'info judicial.xlsx'),
  ('182701890', 0, 0, 'info judicial.xlsx'),
  ('13299904K', 0, 0, 'info judicial.xlsx'),
  ('274765615', 1, 0, 'info judicial.xlsx'),
  ('95722717', 0, 0, 'info judicial.xlsx'),
  ('258807855', 0, 0, 'info judicial.xlsx'),
  ('117929302', 0, 2, 'info judicial.xlsx'),
  ('11619077K', 0, 0, 'info judicial.xlsx'),
  ('112543015', 0, 0, 'info judicial.xlsx'),
  ('152329660', 0, 0, 'info judicial.xlsx'),
  ('84649716', 0, 0, 'info judicial.xlsx'),
  ('133507817', 0, 0, 'info judicial.xlsx'),
  ('144043243', 0, 1, 'info judicial.xlsx'),
  ('91726467', 0, 0, 'info judicial.xlsx'),
  ('160892862', 0, 0, 'info judicial.xlsx'),
  ('133578064', 4, 1, 'info judicial.xlsx'),
  ('142014858', 1, 0, 'info judicial.xlsx'),
  ('98516778', 1, 0, 'info judicial.xlsx'),
  ('12452248K', 1, 0, 'info judicial.xlsx'),
  ('87527387', 0, 0, 'info judicial.xlsx'),
  ('70954567', 0, 0, 'info judicial.xlsx'),
  ('128461922', 0, 0, 'info judicial.xlsx'),
  ('178199560', 0, 0, 'info judicial.xlsx'),
  ('77973141', 0, 0, 'info judicial.xlsx'),
  ('156781738', 2, 0, 'info judicial.xlsx'),
  ('122379817', 0, 0, 'info judicial.xlsx'),
  ('125962092', 0, 0, 'info judicial.xlsx'),
  ('102753933', 2, 0, 'info judicial.xlsx'),
  ('97804834', 0, 0, 'info judicial.xlsx'),
  ('122840778', 1, 0, 'info judicial.xlsx'),
  ('100145219', 0, 0, 'info judicial.xlsx'),
  ('15096394K', 1, 1, 'info judicial.xlsx'),
  ('10119776K', 0, 0, 'info judicial.xlsx'),
  ('123490827', 0, 0, 'info judicial.xlsx'),
  ('87035204', 0, 0, 'info judicial.xlsx')
on conflict (national_id) do update set criminal_count = excluded.criminal_count, labor_count = excluded.labor_count, source_name = excluded.source_name;

insert into public.recruitment_dsal_judicial_causes (national_id, category, description, cause_date, case_reference, court, source_name) values
  ('116471094', 'criminal', 'CUASIDELITO DE HOMICIDIO.', '2023-03-01', '2201302796-3', 'JUZGADO DE GARANTÍA DE CHILLÁN.', 'info judicial.xlsx · penal_cl'),
  ('79426938', 'criminal', 'AMENAZAS SIMPLES CONTRA PERSONAS Y PROPIEDADES ART. 296 No3.', '2017-12-14', '1701185466-4', 'JUZGADO DE LETRAS Y GARANTIA DE MEJILLONES', 'info judicial.xlsx · penal_cl'),
  ('161102024', 'criminal', 'OTROS DELITOS CONTRA LAS PERSONAS', '2025-12-17', '2501560694-3', 'JUZGADO DE GARANTÍA DE COQUIMBO.', 'info judicial.xlsx · penal_cl'),
  ('161102024', 'criminal', 'APROPIACION INDEBIDA ART.470 N°1', '2022-08-16', '2210040806-K', 'JUZGADO DE GARANTÍA DE ANTOFAGASTA.', 'info judicial.xlsx · penal_cl'),
  ('161102024', 'criminal', 'AMENAZAS SIMPLES CONTRA PERSONAS Y PROPIEDADES ART. 296 No3.', '2019-03-12', '1900069759-4', 'JUZGADO DE GARANTÍA DE VICUÑA.', 'info judicial.xlsx · penal_cl'),
  ('161102024', 'criminal', 'INFRINGIR NORMAS HIGIENICAS Y DE SALUBRIDAD', '2020-12-08', '2001176324-4', 'JUZGADO DE GARANTÍA DE COQUIMBO.', 'info judicial.xlsx · penal_cl'),
  ('184036991', 'criminal', 'APROPIACION INDEBIDA ART.470 N°1', '2025-12-15', '2501690474-3', 'JUZGADO DE GARANTÍA DE DIEGO DE ALMAGRO.', 'info judicial.xlsx · penal_cl'),
  ('143154564', 'criminal', 'LESIONES MENOS GRAVES.', '2019-09-30', '1901046535-7', 'JUZGADO DE GARANTÍA DE QUILPUÉ.', 'info judicial.xlsx · penal_cl'),
  ('143154564', 'criminal', 'DESORDENES EN ESPECTACULOS PUBLICOS (494 No 1 CODIGO PENAL).', '2019-11-13', '1901222546-9', 'JUZGADO DE GARANTÍA DE QUILPUÉ.', 'info judicial.xlsx · penal_cl'),
  ('143154564', 'criminal', 'DELITO DESORDENES PUBLICOS ART. 269 (NO FALTA DEL CODIGO 130', '2019-11-13', '1901222546-9', 'JUZGADO DE GARANTÍA DE QUILPUÉ.', 'info judicial.xlsx · penal_cl'),
  ('90427679', 'criminal', 'HURTO SIMPLE POR UN VALOR DE MEDIA A MENOS DE 4 UTM.', '2017-11-23', '1701112362-7', 'JUZGADO DE GARANTIA DE VIÑA DEL MAR.', 'info judicial.xlsx · penal_cl'),
  ('127235163', 'criminal', 'ESTAFAS Y OTRAS DEFRAUDACIONES CONTRA PARTICULARES', '2024-06-24', '2400402254-4', '11º JUZGADO DE GARANTÍA DE SANTIAGO', 'info judicial.xlsx · penal_cl'),
  ('127235163', 'criminal', 'USURPACION VIOLENTA.', '2017-01-20', '1710003010-1', 'JUZGADO DE GARANTÍA DE SAN FERNANDO.', 'info judicial.xlsx · penal_cl'),
  ('127235163', 'criminal', 'LESIONES LEVES.', '2017-10-10', '1700942813-5', 'JUZGADO DE GARANTÍA DE PUENTE ALTO', 'info judicial.xlsx · penal_cl'),
  ('127235163', 'criminal', 'LESIONES LEVES ART. 494 N° 5', '2017-10-10', '1700942813-5', 'JUZGADO DE GARANTÍA DE PUENTE ALTO', 'info judicial.xlsx · penal_cl'),
  ('127235163', 'criminal', 'USURPACIÓN U OCUPACIÓN VIOLENTA DE INMUEBLE. ART. 457 INC 1º', '2018-02-05', '1710003010-1', '5º JUZGADO DE GARANTÍA DE SANTIAGO', 'info judicial.xlsx · penal_cl'),
  ('145343321', 'criminal', 'CUASIDELITO VEHICULO MOTORIZADO LEY TRANSITO', '2022-06-13', '1901071355-5', 'JUZGADO DE GARANTÍA DE TALAGANTE', 'info judicial.xlsx · penal_cl'),
  ('145343321', 'criminal', 'CUASIDELITO VEHICULO MOTORIZADO LEY TRANSITO', '2020-01-03', '1901071355-5', 'JUZGADO DE GARANTÍA DE PUENTE ALTO', 'info judicial.xlsx · penal_cl'),
  ('179304678', 'criminal', 'ACCIDENTE CON RESULTADO DE MUERTE O LESIONES GRAVES. LEY DE.', '2022-11-21', '2201085259-9', 'JUZGADO DE GARANTÍA DE SAN BERNARDO', 'info judicial.xlsx · penal_cl'),
  ('129495200', 'criminal', 'HURTO SIMPLE POR UN VALOR DE 4 A 40 UTM.', '2022-08-11', '2200654234-8', 'JUZGADO DE GARANTÍA DE LOS ANDES.', 'info judicial.xlsx · penal_cl'),
  ('116304090', 'criminal', 'AMENAZAS SIMPLES CONTRA PERSONAS Y PROPIEDADES ART. 296 No3.', '2019-10-07', '1900912406-6', 'JUZGADO DE GARANTÍA DE LA SERENA.', 'info judicial.xlsx · penal_cl'),
  ('120992392', 'criminal', 'LESIONES MENOS GRAVES.', '2026-04-13', '2600525110-8', 'JUZGADO DE GARANTIA DE VIÑA DEL MAR', 'info judicial.xlsx · penal_cl'),
  ('120992392', 'criminal', 'RINA PUBLICA (496 No 10 CODIGO PENAL).', '2018-06-07', '1800477976-9', 'JUZGADO DE GARANTÍA DE QUILPUÉ.', 'info judicial.xlsx · penal_cl'),
  ('150376971', 'criminal', 'LESIONES MENOS GRAVES.', '2016-11-10', '1600181718-7', 'JUZGADO DE GARANTÍA DE VICUÑA.', 'info judicial.xlsx · penal_cl'),
  ('150376971', 'criminal', 'LESIONES LEVES.', '2016-11-10', '1600181718-7', 'JUZGADO DE GARANTÍA DE VICUÑA.', 'info judicial.xlsx · penal_cl'),
  ('143762432', 'criminal', 'INFRINGIR NORMAS HIGIENICAS Y DE SALUBRIDAD', '2020-09-25', '2000825648-K', 'JUZGADO DE GARANTÍA DE VALPARAÍSO.', 'info judicial.xlsx · penal_cl'),
  ('153207089', 'criminal', 'RECEPTACIÓN DE VEHÍCULOS MOTORIZADOS', '2021-10-22', '2100810521-6', 'JUZGADO DE GARANTÍA DE QUILLOTA.', 'info judicial.xlsx · penal_cl'),
  ('83979739', 'criminal', 'AMENAZAS SIMPLES CONTRA PERSONAS Y PROPIEDADES ART. 296 No3.', '2019-06-25', '1900638519-5', 'JUZGADO DE GARANTÍA DE LONCOCHE.', 'info judicial.xlsx · penal_cl'),
  ('263346114', 'criminal', 'CONDUC.ESTADO DE EBRIEDAD CON O SIN DAÑOS O LESIONES LEVES.', '2022-07-01', '2200325860-6', 'JUZGADO DE GARANTÍA DE DIEGO DE ALMAGRO.', 'info judicial.xlsx · penal_cl'),
  ('132816239', 'criminal', 'DESACATO (ART. 240 CODIGO DE PROCEDIMIENTO CIVIL).', '2025-06-30', '2500882958-9', 'JUZGADO DE GARANTÍA DE PUENTE ALTO', 'info judicial.xlsx · penal_cl'),
  ('132816239', 'criminal', 'AMENAZAS CONDIC.C/PERSONAS Y PROPIEDADES ART.296 1Y2,ART.297', '2016-09-09', '1600720181-1', 'JUZGADO DE GARANTÍA DE PUENTE ALTO', 'info judicial.xlsx · penal_cl'),
  ('140992348', 'criminal', 'AMENAZAS SIMPLES CONTRA PERSONAS Y PROPIEDADES ART. 296 No3.', '2020-07-22', '2000658238-K', 'JUZGADO DE GARANTÍA DE DIEGO DE ALMAGRO.', 'info judicial.xlsx · penal_cl'),
  ('140992348', 'criminal', 'CONDUC.BAJO INFLUEN DEL ALCOHOL CON O SIN DANOS O LES.LEVES.', '2019-11-19', '1901116309-5', 'JUZGADO DE GARANTÍA DE DIEGO DE ALMAGRO.', 'info judicial.xlsx · penal_cl'),
  ('140992348', 'criminal', 'INFRINGIR NORMAS HIGIENICAS Y DE SALUBRIDAD', '2020-10-07', '2000962091-6', 'JUZGADO DE GARANTÍA DE DIEGO DE ALMAGRO.', 'info judicial.xlsx · penal_cl'),
  ('112598022', 'criminal', 'ABANDONO O  MALTRATO ANIMAL ART.291 BIS.', '2020-08-17', '2000679133-7', 'JUZGADO DE GARANTÍA DE DIEGO DE ALMAGRO.', 'info judicial.xlsx · penal_cl'),
  ('112598022', 'criminal', 'AMENAZAS SIMPLES CONTRA PERSONAS Y PROPIEDADES ART. 296 No3.', '2019-07-12', '1900608393-8', 'JUZGADO DE GARANTÍA DE DIEGO DE ALMAGRO.', 'info judicial.xlsx · penal_cl'),
  ('133311211', 'criminal', 'AMENAZAS SIMPLES CONTRA PERSONAS Y PROPIEDADES ART. 296 No3.', '2018-08-20', '1800780392-K', 'JUZGADO DE GARANTÍA DE LOS ANDES.', 'info judicial.xlsx · penal_cl'),
  ('133311211', 'criminal', 'FALSIFICACION O USO MALICIOSO DE DOC PÚBL ART. 193,194,196', '2018-02-19', '1700492498-3', 'JUZGADO DE GARANTÍA DE LOS ANDES.', 'info judicial.xlsx · penal_cl'),
  ('133311211', 'criminal', 'OTROS DELITOS CONTRA LA LEY DEL TRANSITO.', '2018-02-15', '1700492498-3', 'JUZGADO DE GARANTÍA DE SAN FELIPE.', 'info judicial.xlsx · penal_cl'),
  ('133311211', 'criminal', 'OTRAS FALTAS CODIGO PENAL.', '2018-02-05', '1800070246-K', 'JUZGADO DE GARANTÍA DE LOS ANDES.', 'info judicial.xlsx · penal_cl'),
  ('133311211', 'criminal', 'AMENAZAS SIMPLES CONTRA PERSONAS Y PROPIEDADES ART. 296 Nº3.', '2023-10-04', '2300975769-4', 'JUZGADO DE GARANTÍA DE OSORNO.', 'info judicial.xlsx · penal_cl'),
  ('133311211', 'criminal', 'AMENAZAS SIMPLES CONTRA PERSONAS Y PROPIEDADES ART. 296 No3.', '2016-03-01', '1600121263-3', 'JUZGADO DE GARANTÍA DE LOS ANDES.', 'info judicial.xlsx · penal_cl'),
  ('170382080', 'criminal', 'AMENAZAS SIMPLES CONTRA PERSONAS Y PROPIEDADES ART. 296 No3.', '2017-04-18', '1700193583-6', 'JUZGADO DE GARANTÍA DE VALLENAR.', 'info judicial.xlsx · penal_cl'),
  ('175452230', 'criminal', 'FALSIFICACION O USO MALICIOSOS DE DOCUMENTOS PUBLICOS.', '2017-05-23', '1700477582-1', 'JUZGADO DE GARANTÍA DE COLINA', 'info judicial.xlsx · penal_cl'),
  ('175452230', 'criminal', 'FALSIFICACION O USO MALICIOSO DE DOC PÚBL ART. 193,194,196', '2017-05-23', '1700477582-1', 'JUZGADO DE GARANTÍA DE COLINA', 'info judicial.xlsx · penal_cl'),
  ('126112157', 'criminal', 'LESIONES MENOS GRAVES.', '2025-02-13', '2401503002-6', 'JUZGADO DE GARANTÍA DE PUERTO MONTT.', 'info judicial.xlsx · penal_cl'),
  ('129394064', 'criminal', 'CUASIDELITO DE LESIONES: ART 490, 491 INC 2deg Y 492.', '2016-09-22', '1600826212-1', 'JUZGADO DE GARANTÍA DE OVALLE.', 'info judicial.xlsx · penal_cl'),
  ('129394064', 'criminal', 'CUASIDELITO DE LESIONES: ART 490, 491 INC 2° Y 492.', '2016-09-22', '1600826212-1', 'JUZGADO DE GARANTÍA DE OVALLE.', 'info judicial.xlsx · penal_cl'),
  ('166640458', 'criminal', 'LESIONES GRAVES', '2025-08-26', '2500912531-3', 'JUZGADO DE GARANTÍA DE OVALLE.', 'info judicial.xlsx · penal_cl'),
  ('94341612', 'criminal', 'CONDUC.ESTADO DE EBRIEDAD CON O SIN DANOS O LESIONES LEVES.', '2019-11-14', '1900981653-7', 'JUZGADO DE GARANTÍA DE SAN FELIPE.', 'info judicial.xlsx · penal_cl'),
  ('11877311K', 'criminal', 'LESIONES MENOS GRAVES.', '2021-04-06', '2100533837-6', 'JUZGADO DE GARANTÍA DE SAN VICENTE DE TAGUA-TAGUA.', 'info judicial.xlsx · penal_cl'),
  ('11877311K', 'criminal', 'CONDUC.BAJO INFLUEN DEL ALCOHOL CON O SIN DANOS O LES.LEVES.', '2019-04-03', '1801259122-1', 'JUZGADO DE GARANTÍA DE RENGO.', 'info judicial.xlsx · penal_cl'),
  ('138270017', 'criminal', 'DANOS SIMPLES.', '2016-01-13', '1600037477-K', 'JUZGADO DE GARANTÍA DE DIEGO DE ALMAGRO.', 'info judicial.xlsx · penal_cl'),
  ('138270017', 'criminal', 'AMENAZAS SIMPLES CONTRA PERSONAS Y PROPIEDADES ART. 296 No3.', '2016-01-13', '1600037234-3', 'JUZGADO DE GARANTÍA DE DIEGO DE ALMAGRO.', 'info judicial.xlsx · penal_cl'),
  ('138270017', 'criminal', 'DESORDENES EN ESPECTACULOS PUBLICOS (494 No 1 CODIGO PENAL).', '2016-01-11', '1600031778-4', 'JUZGADO DE GARANTÍA DE DIEGO DE ALMAGRO.', 'info judicial.xlsx · penal_cl'),
  ('117238024', 'criminal', 'AMENAZAS SIMPLES CONTRA PERSONAS Y PROPIEDADES ART. 296 Nº3.', '2022-06-24', '2200598765-6', 'JUZGADO DE GARANTÍA DE DIEGO DE ALMAGRO.', 'info judicial.xlsx · penal_cl'),
  ('99969873', 'criminal', 'CONTRA SALUD PUBLICA.  ARTS. 313 D AL 315 Y ART. 317.', '2020-07-30', '2000632955-2', 'JUZGADO DE GARANTÍA DE DIEGO DE ALMAGRO.', 'info judicial.xlsx · penal_cl'),
  ('139762789', 'criminal', 'CUASIDELITO DE LESIONES: ART 490, 491 INC 2deg Y 492.', '2017-01-17', '1600283188-4', 'JUZGADO DE GARANTÍA DE DIEGO DE ALMAGRO.', 'info judicial.xlsx · penal_cl'),
  ('139762789', 'criminal', 'CUASIDELITO DE LESIONES: ART 490, 491 INC 2° Y 492.', '2017-01-17', '1600283188-4', 'JUZGADO DE GARANTÍA DE DIEGO DE ALMAGRO.', 'info judicial.xlsx · penal_cl'),
  ('126515669', 'criminal', 'AMENAZAS SIMPLES CONTRA PERSONAS Y PROPIEDADES ART. 296 No3.', '2018-09-26', '1800854558-4', 'JUZGADO DE GARANTÍA DE COQUIMBO.', 'info judicial.xlsx · penal_cl'),
  ('126515669', 'criminal', 'HURTO SIMPLE POR UN VALOR DE MEDIA A MENOS DE 4 UTM.', '2023-09-07', '2300972449-4', 'JUZGADO DE GARANTÍA DE LA SERENA.', 'info judicial.xlsx · penal_cl'),
  ('142399059', 'criminal', 'CUASIDELITO DE LESIONES: ART 490, 491 INC 2° Y 492.', '2024-09-25', '2401108889-5', 'JUZGADO DE GARANTÍA DE CHILLÁN.', 'info judicial.xlsx · penal_cl'),
  ('142399059', 'criminal', 'FALTA DE RESPETO A AUTORIDAD PUBLICA (495 No 4 CODIGO PENAL)', '2016-01-11', '1501200756-3', 'JUZGADO DE GARANTÍA DE ANTOFAGASTA.', 'info judicial.xlsx · penal_cl'),
  ('64030469', 'criminal', 'OTROS HECHOS QUE NO CONSTITUYAN DELITO: AGRUP.1008,1009,1011', '2018-12-12', '1801214875-1', 'JUZGADO DE GARANTÍA DE DIEGO DE ALMAGRO.', 'info judicial.xlsx · penal_cl'),
  ('64030469', 'criminal', 'USURPACION DE NOMBRE.', '2018-12-12', '1801197449-6', 'JUZGADO DE GARANTÍA DE DIEGO DE ALMAGRO.', 'info judicial.xlsx · penal_cl'),
  ('160403594', 'criminal', 'LESIONES LEVES.', '2019-06-26', '1900223699-3', 'JUZGADO DE GARANTÍA DE TALAGANTE', 'info judicial.xlsx · penal_cl'),
  ('160403594', 'criminal', 'INFRINGIR NORMAS HIGIENICAS Y DE SALUBRIDAD', '2021-05-05', '2100399267-2', 'JUZGADO DE GARANTÍA DE TALAGANTE', 'info judicial.xlsx · penal_cl'),
  ('274765615', 'criminal', 'INFRINGIR NORMAS HIGIÉNICAS Y DE SALUBRIDAD', '2021-07-06', '2100506711-9', '7º JUZGADO DE GARANTÍA DE SANTIAGO', 'info judicial.xlsx · penal_cl'),
  ('133578064', 'criminal', 'INFRINGIR NORMAS HIGIENICAS Y DE SALUBRIDAD', '2021-04-21', '2100328664-6', 'JUZGADO DE GARANTÍA DE DIEGO DE ALMAGRO.', 'info judicial.xlsx · penal_cl'),
  ('133578064', 'criminal', 'INFRINGIR NORMAS HIGIENICAS Y DE SALUBRIDAD', '2021-02-18', '2100135933-6', 'JUZGADO DE GARANTÍA DE DIEGO DE ALMAGRO.', 'info judicial.xlsx · penal_cl'),
  ('133578064', 'criminal', 'CONDUC.VEHIC DURANTE VIG ALG.SANCI IMPUEST ART209 LEY 18290.', '2021-11-10', '2100968218-7', 'JUZGADO DE GARANTÍA DE DIEGO DE ALMAGRO.', 'info judicial.xlsx · penal_cl'),
  ('133578064', 'criminal', 'CONDUC.ESTADO DE EBRIEDAD CON O SIN DANOS O LESIONES LEVES.', '2019-11-07', '1900915510-7', 'JUZGADO DE GARANTÍA DE DIEGO DE ALMAGRO.', 'info judicial.xlsx · penal_cl'),
  ('142014858', 'criminal', 'CONDUC.ESTADO DE EBRIEDAD CON O SIN DANOS O LESIONES LEVES.', '2016-07-18', '1500093455-8', 'JUZGADO DE GARANTÍA DE RANCAGUA.', 'info judicial.xlsx · penal_cl'),
  ('98516778', 'criminal', 'REMISOS (RECLUTAMIENTO) DL 2306. ART. 73', '2024-02-14', '2300944809-8', 'JUZGADO DE GARANTÍA DE ANTOFAGASTA.', 'info judicial.xlsx · penal_cl'),
  ('12452248K', 'criminal', 'CONTRA SALUD PUBLICA.  ARTS. 313 D AL 315 Y ART. 317.', '2020-08-21', '2000703095-K', 'JUZGADO DE GARANTÍA DE VALPARAÍSO.', 'info judicial.xlsx · penal_cl'),
  ('156781738', 'criminal', 'LESIONES MENOS GRAVES.', '2021-09-29', '2100876544-5', 'JUZGADO DE GARANTÍA DE CHILLÁN.', 'info judicial.xlsx · penal_cl'),
  ('156781738', 'criminal', 'CONTRA SALUD PUBLICA. ARTS. 313 A Y 313 B', '2020-08-15', '2000832341-1', 'JUZGADO DE GARANTÍA DE CHILLÁN.', 'info judicial.xlsx · penal_cl'),
  ('102753933', 'criminal', 'LESIONES MENOS GRAVES.', '2020-07-23', '2000742730-2', 'JUZGADO DE GARANTÍA DE TALAGANTE', 'info judicial.xlsx · penal_cl'),
  ('102753933', 'criminal', 'DISENSIONES DOMESTICAS (495 NR 6 CODIGO PENAL).', '2018-01-08', '1701090418-8', 'JUZGADO DE GARANTÍA DE TALAGANTE', 'info judicial.xlsx · penal_cl'),
  ('122840778', 'criminal', 'CUASIDELITO DE LESIONES: ART 490, 491 INC 2° Y 492.', '2023-12-27', '2300599917-0', '7º JUZGADO DE GARANTÍA DE SANTIAGO', 'info judicial.xlsx · penal_cl')
on conflict (national_id, category, description, cause_date, case_reference) do nothing;

insert into public.recruitment_dsal_judicial_causes (national_id, category, description, cause_date, case_reference, court, source_name) values
  ('15096394K', 'criminal', 'CONSUMO/PORTE EN LUG.PUB.O PRIV.C/PREVIO CONCIERTO(ART.50).', '2016-03-04', '1600190715-1', 'JUZGADO DE GARANTÍA DE VALPARAÍSO.', 'info judicial.xlsx · penal_cl')
on conflict (national_id, category, description, cause_date, case_reference) do nothing;

insert into public.recruitment_dsal_judicial_causes (national_id, category, description, cause_date, case_reference, court, source_name) values
  ('143154564', 'laboral', 'Participación DNCTE. · Tipo E · RIT 122', '2018-08-31', '122', 'JUZGADO DE LETRAS DE VILLA ALEMANA', 'info judicial.xlsx · laboral_cl'),
  ('105596065', 'laboral', 'Participación DTE. · Tipo O · RIT 678', '2016-06-11', '678', 'JUZGADO DE LETRAS DEL TRABAJO DE ANTOFAGASTA', 'info judicial.xlsx · laboral_cl'),
  ('131196873', 'laboral', 'Participación DTE. · Tipo E · RIT 254', '2021-12-15', '254', 'JUZGADO DE LETRAS DEL TRABAJO DE TEMUCO', 'info judicial.xlsx · laboral_cl'),
  ('131196873', 'laboral', 'Participación DTE. · Tipo O · RIT 1', '2021-02-26', '1', 'JUZGADO DE LETRAS Y GARANTÍA DE PANGUIPULLI', 'info judicial.xlsx · laboral_cl'),
  ('145343321', 'laboral', 'Participación DNCTE. · Tipo E · RIT 5', '2024-01-10', '5', 'JUZGADO DE LETRAS Y GARANTÍA DE ALTO HOSPICIO', 'info judicial.xlsx · laboral_cl'),
  ('145343321', 'laboral', 'Participación DNCTE. · Tipo T · RIT 3090', '2023-12-29', '3090', '1º JUZGADO DE LETRAS DEL TRABAJO DE SANTIAGO', 'info judicial.xlsx · laboral_cl'),
  ('145343321', 'laboral', 'Participación DTE. · Tipo E · RIT 3925', '2023-06-28', '3925', '2º JUZGADO DE LETRAS DEL TRABAJO DE SANTIAGO', 'info judicial.xlsx · laboral_cl'),
  ('145343321', 'laboral', 'Participación DTE. · Tipo O · RIT 31', '2023-06-19', '31', '2º JUZGADO DE LETRAS DE QUILLOTA', 'info judicial.xlsx · laboral_cl'),
  ('150584531', 'laboral', 'Participación DTE. · Tipo O · RIT 1204', '2022-02-24', '1204', '2º JUZGADO DE LETRAS DEL TRABAJO DE SANTIAGO', 'info judicial.xlsx · laboral_cl'),
  ('121572869', 'laboral', 'Participación DTE. · Tipo M · RIT 660', '2024-02-12', '660', '1º JUZGADO DE LETRAS DEL TRABAJO DE SANTIAGO', 'info judicial.xlsx · laboral_cl'),
  ('145709121', 'laboral', 'Participación DTE. · Tipo E · RIT 2956', '2017-07-20', '2956', '2º JUZGADO DE LETRAS DEL TRABAJO DE SANTIAGO', 'info judicial.xlsx · laboral_cl'),
  ('145709121', 'laboral', 'Participación DTE. · Tipo O · RIT 16', '2017-07-04', '16', 'JUZGADO DE LETRAS DE YUNGAY', 'info judicial.xlsx · laboral_cl'),
  ('117932737', 'laboral', 'Participación DTE. · Tipo O · RIT 3289', '2013-08-16', '3289', '1º JUZGADO DE LETRAS DEL TRABAJO DE SANTIAGO', 'info judicial.xlsx · laboral_cl'),
  ('140992348', 'laboral', 'Participación DTE. · Tipo O · RIT 6', '2016-06-13', '6', 'JUZGADO DE LETRAS DE DIEGO DE ALMAGRO', 'info judicial.xlsx · laboral_cl'),
  ('140992348', 'laboral', 'Participación DTE. · Tipo E · RIT 54', '2016-06-13', '54', 'JUZGADO DE LETRAS DEL TRABAJO DE COPIAPÓ', 'info judicial.xlsx · laboral_cl'),
  ('106423563', 'laboral', 'Participación DTE. · Tipo O · RIT 5795', '2014-12-19', '5795', '2º JUZGADO DE LETRAS DEL TRABAJO DE SANTIAGO', 'info judicial.xlsx · laboral_cl'),
  ('133311211', 'laboral', 'Participación DTE. · Tipo O · RIT 1', '2025-01-10', '1', 'JUZGADO DE LETRAS DE DIEGO DE ALMAGRO', 'info judicial.xlsx · laboral_cl'),
  ('175452230', 'laboral', 'Participación DTE. · Tipo O · RIT 3583', '2017-06-09', '3583', '1º JUZGADO DE LETRAS DEL TRABAJO DE SANTIAGO', 'info judicial.xlsx · laboral_cl'),
  ('112041699', 'laboral', 'Participación DNCTE. · Tipo E · RIT 2187', '2024-04-09', '2187', '1º JUZGADO DE LETRAS DEL TRABAJO DE SANTIAGO', 'info judicial.xlsx · laboral_cl'),
  ('112041699', 'laboral', 'Participación DNCTE. · Tipo T · RIT 205', '2024-03-06', '205', 'JUZGADO DE LETRAS DEL TRABAJO DE ANTOFAGASTA', 'info judicial.xlsx · laboral_cl'),
  ('151424791', 'laboral', 'Participación DTE. · Tipo O · RIT 404', '2021-10-29', '404', 'JUZGADO DE LETRAS DEL TRABAJO DE TALCA', 'info judicial.xlsx · laboral_cl'),
  ('145189470', 'laboral', 'Participación DTE. · Tipo E · RIT 2755', '2014-10-22', '2755', '1º JUZGADO DE LETRAS DEL TRABAJO DE SANTIAGO', 'info judicial.xlsx · laboral_cl'),
  ('145189470', 'laboral', 'Participación DTE. · Tipo E · RIT 2528', '2014-09-26', '2528', '1º JUZGADO DE LETRAS DEL TRABAJO DE SANTIAGO', 'info judicial.xlsx · laboral_cl'),
  ('145189470', 'laboral', 'Participación DTE. · Tipo O · RIT 71', '2014-09-15', '71', 'JUZGADO DE LETRAS DE LA CALERA', 'info judicial.xlsx · laboral_cl'),
  ('98052828', 'laboral', 'Participación DTE. · Tipo O · RIT 5861', '2023-08-21', '5861', '2º JUZGADO DE LETRAS DEL TRABAJO DE SANTIAGO', 'info judicial.xlsx · laboral_cl'),
  ('94341612', 'laboral', 'Participación DTE. · Tipo E · RIT 7605', '2023-11-28', '7605', '1º JUZGADO DE LETRAS DEL TRABAJO DE SANTIAGO', 'info judicial.xlsx · laboral_cl'),
  ('94341612', 'laboral', 'Participación DTE. · Tipo O · RIT 1663', '2023-11-23', '1663', 'JUZGADO DE LETRAS DEL TRABAJO DE ANTOFAGASTA', 'info judicial.xlsx · laboral_cl'),
  ('99262206', 'laboral', 'Participación DTE. · Tipo E · RIT 2399', '2014-09-10', '2399', '2º JUZGADO DE LETRAS DEL TRABAJO DE SANTIAGO', 'info judicial.xlsx · laboral_cl'),
  ('99262206', 'laboral', 'Participación DTE. · Tipo E · RIT 1721', '2014-07-01', '1721', '1º JUZGADO DE LETRAS DEL TRABAJO DE SANTIAGO', 'info judicial.xlsx · laboral_cl'),
  ('99262206', 'laboral', 'Participación DTE. · Tipo E · RIT 1564', '2014-06-17', '1564', '1º JUZGADO DE LETRAS DEL TRABAJO DE SANTIAGO', 'info judicial.xlsx · laboral_cl'),
  ('99262206', 'laboral', 'Participación DTE. · Tipo M · RIT 129', '2014-06-11', '129', 'JUZGADO DE LETRAS DEL TRABAJO DE CALAMA', 'info judicial.xlsx · laboral_cl'),
  ('105038321', 'laboral', 'Participación DTE. · Tipo E · RIT 160', '2024-05-20', '160', 'JUZGADO DE LETRAS DEL TRABAJO DE IQUIQUE', 'info judicial.xlsx · laboral_cl'),
  ('105038321', 'laboral', 'Participación DTE. · Tipo E · RIT 49', '2024-05-20', '49', 'JUZGADO DE LETRAS Y GARANTÍA DE ALTO HOSPICIO', 'info judicial.xlsx · laboral_cl'),
  ('105038321', 'laboral', 'Participación DTE. · Tipo O · RIT 356', '2024-05-10', '356', 'JUZGADO DE LETRAS DEL TRABAJO DE LA SERENA', 'info judicial.xlsx · laboral_cl'),
  ('144931432', 'laboral', 'Participación DNCTE. · Tipo T · RIT 4458', '2025-12-23', '4458', '1º JUZGADO DE LETRAS DEL TRABAJO DE SANTIAGO', 'info judicial.xlsx · laboral_cl'),
  ('144931432', 'laboral', 'Participación DNCTE. · Tipo T · RIT 43', '2017-02-01', '43', 'JUZGADO DE LETRAS DEL TRABAJO DE VALPARAÍSO', 'info judicial.xlsx · laboral_cl'),
  ('108594675', 'laboral', 'Participación DTE. · Tipo O · RIT 581', '2021-06-15', '581', 'JUZGADO DE LETRAS DEL TRABAJO DE ANTOFAGASTA', 'info judicial.xlsx · laboral_cl'),
  ('108239719', 'laboral', 'Participación DTE. · Tipo O · RIT 632', '2016-02-03', '632', '2º JUZGADO DE LETRAS DEL TRABAJO DE SANTIAGO', 'info judicial.xlsx · laboral_cl'),
  ('117929302', 'laboral', 'Participación DNCTE. · Tipo E · RIT 796', '2023-10-03', '796', 'JUZGADO DE LETRAS DEL TRABAJO DE CONCEPCIÓN', 'info judicial.xlsx · laboral_cl'),
  ('117929302', 'laboral', 'Participación DNCTE. · Tipo T · RIT 2316', '2023-09-27', '2316', '1º JUZGADO DE LETRAS DEL TRABAJO DE SANTIAGO', 'info judicial.xlsx · laboral_cl'),
  ('144043243', 'laboral', 'Participación DTE. · Tipo O · RIT 437', '2022-03-28', '437', 'JUZGADO DE LETRAS DEL TRABAJO DE CONCEPCIÓN', 'info judicial.xlsx · laboral_cl'),
  ('133578064', 'laboral', 'Participación DNCTE. · Tipo T · RIT 5', '2015-10-30', '5', 'JUZGADO DE LETRAS DE DIEGO DE ALMAGRO', 'info judicial.xlsx · laboral_cl'),
  ('15096394K', 'laboral', 'Participación DTE. · Tipo O · RIT 1156', '2016-11-02', '1156', 'JUZGADO DE LETRAS DEL TRABAJO DE VALPARAÍSO', 'info judicial.xlsx · laboral_cl')
on conflict (national_id, category, description, cause_date, case_reference) do nothing;

create or replace function public.get_dsal_roster_identity(p_national_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  normalized_national_id text := public.normalize_dsal_precandidate_rut(p_national_id);
  roster_record public.recruitment_dsal_roster%rowtype;
begin
  if not public.is_valid_dsal_precandidate_rut(normalized_national_id) then
    return jsonb_build_object('found', false);
  end if;

  select * into roster_record
    from public.recruitment_dsal_roster
   where national_id = normalized_national_id and is_active = true;

  if roster_record.national_id is null then
    return jsonb_build_object('found', false);
  end if;

  return jsonb_build_object(
    'found', true,
    'first_name', roster_record.first_name,
    'last_name', roster_record.last_name,
    'second_last_name', roster_record.second_last_name
  );
end;
$function$;

revoke all on function public.get_dsal_roster_identity(text) from public, anon, authenticated;
grant execute on function public.get_dsal_roster_identity(text) to anon, authenticated;

create or replace function public.submit_dsal_precandidate_application(
  p_national_id text, p_first_name text, p_last_name text, p_second_last_name text,
  p_address_line text, p_region text, p_current_city text, p_driver_license_classes text[],
  p_dsal_role text, p_phone text, p_personal_email text, p_comments text default null
)
returns jsonb language plpgsql security definer set search_path = public
as $function$
declare
  allowed_licenses constant text[] := array['A1 (Ley 18.290)', 'A2', 'A3', 'B'];
  normalized_national_id text := public.normalize_dsal_precandidate_rut(p_national_id);
  normalized_address_line text := public.normalize_dsal_precandidate_name(p_address_line);
  normalized_region text := public.normalize_dsal_precandidate_text(p_region);
  normalized_current_city text := public.normalize_dsal_precandidate_name(p_current_city);
  normalized_phone text := public.normalize_dsal_precandidate_phone(p_phone);
  normalized_personal_email text := lower(public.normalize_dsal_precandidate_text(p_personal_email));
  normalized_comments text := public.normalize_dsal_precandidate_name(p_comments);
  normalized_licenses text[]; invalid_licenses text[]; saved_id uuid;
  roster_record public.recruitment_dsal_roster%rowtype;
begin
  if not public.is_valid_dsal_precandidate_rut(normalized_national_id) then
    raise exception 'El RUT ingresado no es válido';
  end if;

  select * into roster_record from public.recruitment_dsal_roster
   where national_id = normalized_national_id and is_active = true;
  if roster_record.national_id is null then
    raise exception 'El RUT no se encuentra en la nómina vigente del contrato DSAL';
  end if;

  if normalized_address_line is null or normalized_region is null or normalized_current_city is null
     or normalized_personal_email is null then
    raise exception 'Completa todos los campos obligatorios';
  end if;
  if normalized_phone is null or normalized_phone !~ '^\+569[0-9]{8}$' then
    raise exception 'El teléfono debe contener 8 dígitos después del prefijo +56 9';
  end if;
  if not public.is_valid_dsal_precandidate_email(normalized_personal_email) then
    raise exception 'El email personal no tiene un formato válido';
  end if;
  if p_dsal_role not in ('Interno Mina', 'Furgón Eléctrico', 'Bus Eléctrico', 'Ciudades Base') then
    raise exception 'Selecciona un rol DSAL válido';
  end if;

  select coalesce(array_agg(distinct license order by license), '{}'::text[]) into normalized_licenses
    from unnest(coalesce(p_driver_license_classes, '{}'::text[])) as license
   where nullif(trim(license), '') is not null;
  if cardinality(normalized_licenses) = 0 then raise exception 'Selecciona al menos una licencia de conducir'; end if;
  select coalesce(array_agg(license), '{}'::text[]) into invalid_licenses
    from unnest(normalized_licenses) as license where license <> all(allowed_licenses);
  if cardinality(invalid_licenses) > 0 then raise exception 'La postulación contiene licencias no permitidas'; end if;
  if exists (select 1 from public.recruitment_precandidates where national_id = normalized_national_id) then
    raise exception 'Este RUT ya registra una postulación y no puede volver a enviarse';
  end if;

  begin
    insert into public.recruitment_precandidates (national_id, first_name, last_name, second_last_name, full_name, address_line, region, current_city, driver_license_classes, dsal_role, phone, personal_email, comments, metadata)
    values (normalized_national_id, roster_record.first_name, roster_record.last_name, roster_record.second_last_name, concat_ws(' ', roster_record.first_name, roster_record.last_name, roster_record.second_last_name), normalized_address_line, normalized_region, normalized_current_city, normalized_licenses, p_dsal_role, normalized_phone, normalized_personal_email, normalized_comments, jsonb_build_object('source', 'public_dsal_application', 'roster_source', roster_record.source_name))
    returning id into saved_id;
  exception when unique_violation then
    raise exception 'Este RUT ya registra una postulación y no puede volver a enviarse';
  end;
  return jsonb_build_object('id', saved_id, 'status', 'received');
end;
$function$;

create or replace function public.get_recruitment_precandidates_page(p_status text default 'pending', p_search text default null, p_limit integer default 50, p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path = public
as $function$
declare
  current_user_id uuid := auth.uid(); normalized_status text := coalesce(nullif(trim(p_status), ''), 'pending');
  normalized_search text := nullif(lower(trim(coalesce(p_search, ''))), '');
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100); safe_offset integer := greatest(coalesce(p_offset, 0), 0); payload jsonb;
begin
  if current_user_id is null then raise exception 'Usuario no autenticado'; end if;
  perform public.assert_dsal_precandidate_review_access(current_user_id);
  if normalized_status not in ('pending', 'approved', 'rejected', 'archived', 'all') then raise exception 'Estado de precandidato inválido'; end if;
  with filtered as (
    select rp.*, approved_hr.folio as approved_folio,
      coalesce(js.criminal_count, 0) as criminal_cause_count, coalesce(js.labor_count, 0) as labor_cause_count,
      coalesce(criminal.details, '[]'::jsonb) as criminal_cause_details, coalesce(laboral.details, '[]'::jsonb) as labor_cause_details
      from public.recruitment_precandidates rp
      left join public.recruitment_cases approved_rc on approved_rc.id = rp.approved_recruitment_case_id
      left join public.hiring_requests approved_hr on approved_hr.id = approved_rc.hiring_request_id
      left join public.recruitment_dsal_judicial_summary js on js.national_id = rp.national_id
      left join lateral (select jsonb_agg(jsonb_build_object('description', description, 'date', to_char(cause_date, 'DD-MM-YYYY')) order by cause_date nulls last, id) as details from public.recruitment_dsal_judicial_causes where national_id = rp.national_id and category = 'criminal') criminal on true
      left join lateral (select jsonb_agg(jsonb_build_object('description', description, 'date', to_char(cause_date, 'DD-MM-YYYY')) order by cause_date nulls last, id) as details from public.recruitment_dsal_judicial_causes where national_id = rp.national_id and category = 'laboral') laboral on true
     where (normalized_status = 'all' or rp.status = normalized_status)
       and (normalized_search is null or lower(rp.full_name) like '%' || normalized_search || '%' or lower(rp.national_id) like '%' || normalized_search || '%' or lower(rp.personal_email) like '%' || normalized_search || '%' or lower(rp.phone) like '%' || normalized_search || '%' or lower(rp.dsal_role) like '%' || normalized_search || '%')
  ), counted as (select count(*)::integer as total_count from filtered), page_items as (select * from filtered order by submitted_at desc, created_at desc limit safe_limit offset safe_offset)
  select jsonb_build_object('items', coalesce(jsonb_agg(to_jsonb(page_items) order by page_items.submitted_at desc, page_items.created_at desc), '[]'::jsonb), 'total_count', (select total_count from counted), 'summary', jsonb_build_object('pending', (select count(*) from public.recruitment_precandidates where status = 'pending'), 'approved', (select count(*) from public.recruitment_precandidates where status = 'approved'), 'rejected', (select count(*) from public.recruitment_precandidates where status = 'rejected'))) into payload from page_items;
  return coalesce(payload, jsonb_build_object('items', '[]'::jsonb, 'total_count', 0, 'summary', jsonb_build_object('pending', 0, 'approved', 0, 'rejected', 0)));
end;
$function$;

revoke all on function public.submit_dsal_precandidate_application(text,text,text,text,text,text,text,text[],text,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_dsal_precandidate_application(text,text,text,text,text,text,text,text[],text,text,text,text) to anon, authenticated;
revoke all on function public.get_recruitment_precandidates_page(text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.get_recruitment_precandidates_page(text,text,integer,integer) to authenticated;
notify pgrst, 'reload schema';
