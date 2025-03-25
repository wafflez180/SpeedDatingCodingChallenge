import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Container, Typography, Paper } from '@mui/material';

const Home: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            textAlign: 'center',
            maxWidth: 400,
            width: '100%',
          }}
        >
          <Typography variant="h4" component="h1" gutterBottom>
            Speed Dating
          </Typography>
          <Typography variant="body1" paragraph>
            Record your video introduction and start matching with others!
          </Typography>
          <Box sx={{ mt: 4 }}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              fullWidth
              onClick={() => navigate('/record')}
              sx={{ mb: 2 }}
            >
              Record Your Video
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              size="large"
              fullWidth
              onClick={() => navigate('/videos')}
            >
              Watch Others
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default Home; 