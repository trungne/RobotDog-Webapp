import { toDegrees } from "@/lib/math-utils";

type InverseKinematicsParams = {
  endEffectorPosition: { x: number; y: number; z: number };
  endEffectorRadius: number; // r
  endEffectorToMidJointLength: number; // l
  midJointToBaseLength: number; // L
  baseRadius: number; // R
};

type InverseKinematicsResult = {
  theta1: number;
  theta2: number;
  theta3: number;
};
export const getAnglesFromPosition = ({
  endEffectorPosition: { x, y, z },
  endEffectorRadius: r,
  endEffectorToMidJointLength: l,
  midJointToBaseLength: L,
  baseRadius: R,
}: InverseKinematicsParams): InverseKinematicsResult => {
  // Theta 1
  // a1 = C(1) + r - R;
  // a_1 = a1^2 + l^2 + C(2)^2 + C(3)^2 - L^2 + 2*a1*l;
  // b_1 = -4*C(3)*l;
  // c_1 = a1^2 + l^2 + C(2)^2 + C(3)^2 - L^2 - 2*a1*l;
  // theta1_1 = 2*atan((-b_1 + sqrt(b_1^2 - 4*a_1*c_1)) / (2*a_1));
  // theta1_2 = 2*atan((-b_1 - sqrt(b_1^2 - 4*a_1*c_1)) / (2*a_1));

  // if (rad2deg(theta1_1) > 90 || rad2deg(theta1_1) < -90)
  //     theta1 = theta1_2;
  // else
  //     theta1 = theta1_1;
  // end
  const a1 = x + r - R;

  const a_1 = a1 ** 2 + l ** 2 + y ** 2 + z ** 2 - L ** 2 + 2 * a1 * l;
  const b_1 = -4 * z * l;
  const c_1 = a1 ** 2 + l ** 2 + y ** 2 + z ** 2 - L ** 2 - 2 * a1 * l;

  const theta1_1 =
    2 * Math.atan((-b_1 + Math.sqrt(b_1 ** 2 + 4 * a_1 * c_1)) / (2 * a_1));
  const theta1_2 =
    2 * Math.atan((-b_1 - Math.sqrt(b_1 ** 2 - 4 * a_1 * c_1)) / (2 * a_1));

  let theta1: number | null = null;

  if (toDegrees(theta1_1) > 90 || toDegrees(theta1_1) < -90) {
    theta1 = theta1_2;
  } else {
    theta1 = theta1_1;
  }

  // Theta 2
  // a2 = C(1) - 0.5*r + 0.5*R;
  // b2 = C(2) + sqrt(3)/2*r - sqrt(3)/2*R;
  // a_2 = a2^2 + b2^2 + C(3)^2 + l^2 - L^2 - a2*l + sqrt(3)*b2*l;
  // b_2 = -4*C(3)*l;
  // c_2 = a2^2 + b2^2 + C(3)^2 + l^2 - L^2 + a2*l - sqrt(3)*b2*l;
  // theta2_1 = 2*atan((-b_2 + sqrt(b_2^2 - 4*a_2*c_2)) / (2*a_2));
  // theta2_2 = 2*atan((-b_2 - sqrt(b_2^2 - 4*a_2*c_2)) / (2*a_2));

  // if (rad2deg(theta2_1) > 90 || rad2deg(theta2_1) < -90)
  //     theta2 = theta2_2;
  // else
  //     theta2 = theta2_1;
  // end

  const a2 = x - 0.5 * r + 0.5 * R;
  const b2 = y + (Math.sqrt(3) / 2) * r - (Math.sqrt(3) / 2) * R;
  const a_2 =
    a2 ** 2 +
    b2 ** 2 +
    z ** 2 +
    l ** 2 -
    L ** 2 -
    a2 * l +
    Math.sqrt(3) * b2 * l;

  const b_2 = -4 * z * l;

  const c_2 =
    a2 ** 2 +
    b2 ** 2 +
    z ** 2 +
    l ** 2 -
    L ** 2 +
    a2 * l -
    Math.sqrt(3) * b2 * l;

  const theta2_1 =
    2 * Math.atan((-b_2 + Math.sqrt(b_2 ** 2 - 4 * a_2 * c_2)) / (2 * a_2));
  const theta2_2 =
    2 * Math.atan((-b_2 - Math.sqrt(b_2 ** 2 - 4 * a_2 * c_2)) / (2 * a_2));

  let theta2: number | null = null;

  if (toDegrees(theta2_1) > 90 || toDegrees(theta2_1) < -90) {
    theta2 = theta2_2;
  } else {
    theta2 = theta2_1;
  }

  // Theta 3
  //   a3 = C(1) - 0.5*r + 0.5*R;
  //   b3 = C(2) - sqrt(3)/2*r + sqrt(3)/2*R;
  //   a_3 = a3^2 + b3^2 + C(3)^2 + l^2 - L^2 - a3*l - sqrt(3)*b3*l;
  //   b_3 = -4*C(3)*l;
  //   c_3 = a3^2 + b3^2 + C(3)^2 + l^2 - L^2 + a3*l + sqrt(3)*b3*l;
  //   theta3_1 = 2*atan((-b_3 + sqrt(b_3^2 - 4*a_3*c_3)) / (2*a_3));
  //   theta3_2 = 2*atan((-b_3 - sqrt(b_3^2 - 4*a_3*c_3)) / (2*a_3));

  //   if (rad2deg(theta3_1) > 90 || rad2deg(theta3_1) < -90)
  //       theta3 = theta3_2;
  //   else
  //       theta3 = theta3_1;
  //   end
  const a3 = x - 0.5 * r + 0.5 * R;
  const b3 = y - (Math.sqrt(3) / 2) * r + (Math.sqrt(3) / 2) * R;
  const a_3 =
    a3 ** 2 +
    b3 ** 2 +
    z ** 2 +
    l ** 2 -
    L ** 2 -
    a3 * l -
    Math.sqrt(3) * b3 * l;
  const b_3 = -4 * z * l;
  const c_3 =
    a3 ** 2 +
    b3 ** 2 +
    z ** 2 +
    l ** 2 -
    L ** 2 +
    a3 * l +
    Math.sqrt(3) * b3 * l;

  const theta3_1 =
    2 * Math.atan((-b_3 + Math.sqrt(b_3 ** 2 - 4 * a_3 * c_3)) / (2 * a_3));

  const theta3_2 =
    2 * Math.atan((-b_3 - Math.sqrt(b_3 ** 2 - 4 * a_3 * c_3)) / (2 * a_3));

  let theta3: number | null = null;

  if (toDegrees(theta3_1) > 90 || toDegrees(theta3_1) < -90) {
    theta3 = theta3_2;
  } else {
    theta3 = theta3_1;
  }

  return {
    theta1: toDegrees(theta1),
    theta2: toDegrees(theta2),
    theta3: toDegrees(theta3),
  };
};
