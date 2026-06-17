import { ReactNode } from "react";
import {
  AppBar, Box, BottomNavigation, BottomNavigationAction, Drawer,
  List, ListItemButton, ListItemIcon, ListItemText, Toolbar, Typography,
  useMediaQuery, useTheme,
} from "@mui/material";
import PeopleIcon from "@mui/icons-material/People";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import PaidIcon from "@mui/icons-material/Paid";
import { Link, Outlet, useLocation } from "react-router-dom";

const NAV = [
  { to: "/patients", label: "Patients", icon: <PeopleIcon /> },
  { to: "/inventory", label: "Inventory", icon: <Inventory2Icon /> },
  { to: "/funds", label: "Funds", icon: <PaidIcon /> },
];
const DRAWER_WIDTH = 240;

export default function AppShell({ children }: { children?: ReactNode }) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const { pathname } = useLocation();
  const current = NAV.find((n) => pathname.startsWith(n.to))?.to ?? "/patients";

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar variant="dense">
          <Typography variant="h6" sx={{ flexGrow: 1 }}>Grace Homoeo</Typography>
        </Toolbar>
      </AppBar>

      {isDesktop && (
        <Drawer
          variant="permanent"
          sx={{ width: DRAWER_WIDTH, "& .MuiDrawer-paper": { width: DRAWER_WIDTH } }}
        >
          <Toolbar variant="dense" />
          <List>
            {NAV.map((n) => (
              <ListItemButton key={n.to} component={Link} to={n.to} selected={current === n.to}>
                <ListItemIcon>{n.icon}</ListItemIcon>
                <ListItemText primary={n.label} />
              </ListItemButton>
            ))}
          </List>
        </Drawer>
      )}

      <Box component="main" sx={{ flexGrow: 1, p: 2, pb: isDesktop ? 2 : 9 }}>
        <Toolbar variant="dense" />
        {children ?? <Outlet />}
      </Box>

      {!isDesktop && (
        <BottomNavigation
          value={current}
          showLabels
          sx={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: (t) => t.zIndex.drawer + 1 }}
        >
          {NAV.map((n) => (
            <BottomNavigationAction
              key={n.to}
              component={Link}
              to={n.to}
              value={n.to}
              label={n.label}
              icon={n.icon}
            />
          ))}
        </BottomNavigation>
      )}
    </Box>
  );
}
