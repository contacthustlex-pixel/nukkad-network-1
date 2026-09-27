-- Extra Mukherjee Nagar network shops (run after 001 + 002).

insert into businesses (name, slug, phone, category_id, maps_url, instagram_url)
select 'FitZone Gym', 'fitzone-gym', '9844444444', id, 'https://maps.google.com/?q=FitZone+Gym+Mukherjee+Nagar', 'https://instagram.com/'
from categories where name = 'Gym'
on conflict (slug) do nothing;

insert into businesses (name, slug, phone, category_id, maps_url, instagram_url)
select 'Rhythm Dance Class', 'rhythm-dance', '9855555555', id, 'https://maps.google.com/?q=Rhythm+Dance+Mukherjee+Nagar', 'https://instagram.com/'
from categories where name = 'Gym'
on conflict (slug) do nothing;
