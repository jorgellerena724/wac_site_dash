const apiUrl = 'http://172.16.1.233:3002/api/';
const imgUrl = `${apiUrl}images/`;

export const environment = {
  production: true,
  api: `${apiUrl}`,
  api_users: `${apiUrl}users/`,
  api_security: `${apiUrl}auth/`,
  api_img: `${imgUrl}`,
};
