const apiUrl = 'https://api.shirkasoft.net/api/';
const imgUrl = `${apiUrl}images/`;
const imgPath = `assets/img/`;

export const environment = {
  production: true,
  api: `${apiUrl}`,
  api_users: `${apiUrl}users/`,
  api_security: `${apiUrl}auth/`,
  api_img: `${imgUrl}`,
  imgPath: imgPath,
};
