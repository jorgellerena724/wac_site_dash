const apiUrl = 'http://localhost:3002/api/';
const imgUrl = `${apiUrl}images/`;
const imgPath = `/assets/img/`;

export const environment = {
  production: false,
  api: `${apiUrl}`,
  api_users: `${apiUrl}users/`,
  api_security: `${apiUrl}auth/`,
  api_img: `${imgUrl}`,
  imgPath: imgPath,
};
